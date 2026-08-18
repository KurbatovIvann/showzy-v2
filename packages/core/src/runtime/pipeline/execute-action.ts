/**
 * `executeAction` — the one execution pipeline every action runs through
 * (fnd-T12 — core.md §4). The step order is fixed, with no per-action
 * variation:
 *
 *   1. validate input (Zod)
 *   2. authenticate the principal / read transport selectors
 *   3. rate limit                        (slot — fnd-T14)
 *   4. authorization preflight           (short read-only transaction)
 *   5. replay probe + confirmation gate  (slot — fnd-T20)
 *   6. idempotency reserve               (slot — fnd-T15)
 *   7. execution transaction: statement timeout, TOCTOU re-authorization,
 *      handler with deadline/abort signal
 *   8. output validation before commit   (mismatch = `CoreInvariantError`)
 *   9. same-transaction outbox/audit/idempotency-finalize slots
 *  10. commit — or roll back and record the failed outcome separately
 *
 * `risk: read` actions run in a database read-only transaction and their
 * handlers receive the `ReadTx` capability, so a write can neither compile
 * nor execute. Public-global handlers are bound to their declared
 * projection grant. The pipeline emits one structured start and one finish
 * log line and drives the telemetry seam the apps bind to OTel/Sentry.
 */
import {
  createReadTx,
  projectionGrants as runtimeProjectionGrants,
  type ReadTx,
  type Tx,
} from "@showzy/db";
import { sql } from "drizzle-orm";
import type { z } from "zod";

import {
  CoreError,
  CoreInvariantError,
  PermissionDeniedError,
  TimeoutError,
  ValidationError,
} from "../../errors/index.js";
import type { AnyActionContract } from "../action-registry.js";
import {
  createAccountContext,
  createConsumerContext,
  createCustomerContext,
  createPublicContext,
  createStaffContext,
  createSystemContext,
  effectiveCompanyId,
  type ActionRequestMeta,
  type ContextRuntime,
} from "../context/factories.js";
import { assertDeclaredPermissions } from "../context/permissions.js";
import type { ActionCtx } from "../context/types.js";
import { createEmitBuffer } from "../events/emit.js";
import type { ImplementedAction } from "../implement-action.js";
import type {
  AuditTargetFn,
  ConfirmationSummaryEnv,
  MaybePromise,
  TargetResolver,
} from "../types.js";
import { createCtxCallAtomic } from "./ctx-call-atomic.js";
import { createCtxCall } from "./ctx-call.js";
import type {
  ActionPipelineDeps,
  ConfirmationGrant,
  PipelineHookEnv,
  PipelineHookRequestMeta,
  PipelineRequestMeta,
  PreflightAuthorization,
  PrincipalInvocation,
} from "./types.js";

/** One action invocation, as composed by a transport or a worker loop. */
export interface ActionInvocation<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TTarget,
> {
  readonly action: ImplementedAction<TInput, TOutput, TTarget>;
  /** Raw, untrusted input — validated as pipeline step 1. */
  readonly input: unknown;
  readonly request: PipelineRequestMeta;
  readonly principal: PrincipalInvocation;
}

/** Everything the per-step helpers need about one validated invocation. */
interface RunEnv<TInput extends z.ZodType, TOutput extends z.ZodType, TTarget> {
  readonly deps: ActionPipelineDeps;
  readonly action: ImplementedAction<TInput, TOutput, TTarget>;
  readonly contract: AnyActionContract;
  readonly request: ActionRequestMeta;
  readonly principal: PrincipalInvocation;
  readonly input: z.output<TInput>;
  readonly makeRuntime: <TDb>(db: TDb) => ContextRuntime<TDb>;
}

export async function executeAction<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TTarget,
>(
  deps: ActionPipelineDeps,
  invocation: ActionInvocation<TInput, TOutput, TTarget>,
): Promise<z.output<TOutput>> {
  const now = deps.now ?? Date.now;
  const { contract } = invocation.action;
  const principal = invocation.principal;
  const startedAt = now();
  // The whole-pipeline deadline (core.md §2 `timeout`), shared with the
  // handler and — later — nested `ctx.call`s through the abort signal.
  const deadline = startedAt + contract.timeout;
  const controller = new AbortController();
  const request: PipelineHookRequestMeta = {
    action: contract.name,
    ...invocation.request,
  };

  const log = deps.logger.child({
    request_id: request.requestId,
    correlation_id: request.correlationId,
    action: contract.name,
    channel: request.channel,
    ...(request.aiTraceId !== undefined
      ? { ai_trace_id: request.aiTraceId }
      : {}),
    ...(request.toolCallId !== undefined
      ? { tool_call_id: request.toolCallId }
      : {}),
  });
  const span = deps.telemetry?.startSpan({
    requestId: request.requestId,
    correlationId: request.correlationId,
    action: contract.name,
    channel: request.channel,
    ...(request.aiTraceId !== undefined
      ? { aiTraceId: request.aiTraceId }
      : {}),
    ...(request.toolCallId !== undefined
      ? { toolCallId: request.toolCallId }
      : {}),
  });

  // Identity evidence strengthens as the pipeline advances; the finish log
  // line and the failure-path hooks use the strongest available level.
  let executionCtx: ActionCtx | undefined;
  // The execution transaction, boxed for `ctx.call` (fnd-T19) and cleared
  // when it ends, so a context escaping the handler cannot call.
  let executionTx: Tx | undefined;
  let authorization: PreflightAuthorization | undefined;
  let validatedInput: unknown;
  let reserved: { readonly reservation: unknown } | undefined;
  let replayed = false;

  const resolveIdentity = (): {
    actorType: string | null;
    actorId: string | null;
    companyId: string | null;
  } => {
    if (executionCtx !== undefined) {
      return {
        actorType: executionCtx.actor.type,
        actorId: executionCtx.actor.id,
        companyId: effectiveCompanyId(executionCtx),
      };
    }
    if (authorization !== undefined) {
      return {
        actorType: authorization.actor.type,
        actorId: authorization.actor.id,
        companyId: authorization.companyId,
      };
    }
    // Pre-authorization best effort — such lines may carry no company
    // (core.md §3); a system scope comes from trusted enqueuing code.
    switch (principal.mode) {
      case "system":
        return {
          actorType: "system",
          actorId: principal.serviceName,
          companyId:
            principal.scope.scope === "tenant"
              ? principal.scope.companyId
              : null,
        };
      case "public":
        return {
          actorType: "anonymous",
          actorId: "anonymous",
          companyId: null,
        };
      default:
        return principal.session !== null
          ? {
              actorType: "user",
              actorId: principal.session.userId,
              companyId: null,
            }
          : { actorType: null, actorId: null, companyId: null };
    }
  };

  const finish = (outcome: string): void => {
    const durationMs = now() - startedAt;
    const identity = resolveIdentity();
    const fields = {
      actor_type: identity.actorType,
      actor_id: identity.actorId,
      company_id: identity.companyId,
      outcome,
      duration_ms: durationMs,
      ...(replayed ? { replayed: true } : {}),
    };
    // Invariant violations are server bugs and must alert; every other
    // outcome (including denials and conflicts) is an expected result.
    if (outcome === "INTERNAL") {
      log.error(fields, "action finished");
    } else {
      log.info(fields, "action finished");
    }
    span?.end({
      outcome,
      actorType: identity.actorType,
      actorId: identity.actorId,
      companyId: identity.companyId,
      durationMs,
    });
  };

  log.info("action started");

  try {
    // 1. Validate input — before any side effect or database access.
    const parsedInput = await contract.input.safeParseAsync(invocation.input);
    if (!parsedInput.success) {
      throw new ValidationError(parsedInput.error.issues);
    }
    const input: z.output<TInput> = parsedInput.data;
    validatedInput = input;

    // 2. Authenticate the principal and read transport selectors. Selector
    //    *verification* is authorization and happens inside transactions
    //    (steps 4/7); nothing here grants access.
    assertPrincipalShape(contract, principal);
    assertAuthenticated(principal);
    assertRequiredProtocolHooks(contract, deps.hooks);

    // One emission buffer per invocation (fnd-T16): `ctx.emit` validates and
    // buffers synchronously; the buffer flushes into the outbox in step 9,
    // inside the execution transaction. Preflight contexts carry the same
    // `emit`, but nothing outside the handler ever receives those contexts.
    const emitBuffer = createEmitBuffer({ contract, now });

    // One `ctx.call` closure per invocation (fnd-T19 — core.md §9). Its
    // execution boxes stay empty until step 7 constructs the context, so
    // preflight contexts carry a `call` that refuses to run.
    const getExecution = ():
      { readonly tx: Tx; readonly ctx: ActionCtx } | undefined =>
      executionCtx !== undefined && executionTx !== undefined
        ? { tx: executionTx, ctx: executionCtx }
        : undefined;
    const ctxCall = createCtxCall({
      deps,
      callerContract: contract,
      request,
      deadline,
      signal: controller.signal,
      now,
      getExecution,
      path: [contract.name],
    });

    // One `ctx.callAtomic` closure per invocation (fnd-T19A — core.md §9,
    // ADR-0021): the same execution boxing, plus the one-atomic-edge
    // latch. Root gating (writable + idempotent caller, declared edge) is
    // asserted inside from the shared rule list.
    const ctxCallAtomic = createCtxCallAtomic({
      deps,
      callerContract: contract,
      request,
      causationId: request.causationId ?? request.requestId,
      deadline,
      signal: controller.signal,
      now,
      getExecution,
      path: [contract.name],
    });

    const env: RunEnv<TInput, TOutput, TTarget> = {
      deps,
      action: invocation.action,
      contract,
      request,
      principal,
      input,
      makeRuntime: <TDb>(db: TDb): ContextRuntime<TDb> => ({
        db,
        logger: deps.logger,
        deadline,
        signal: controller.signal,
        emit: emitBuffer.emit,
        call: ctxCall,
        callAtomic: ctxCallAtomic,
      }),
    };
    const hookEnv: PipelineHookEnv = { contract, request, principal, input };

    // 3. Rate limit (slot — fnd-T14).
    await deps.hooks?.rateLimit?.enforce(hookEnv);

    // 4. Authorization preflight, only when the action will create
    //    confirmation challenges or idempotency reservations. Never the
    //    only authorization check — step 7 re-authorizes in-transaction.
    const needsPreflight =
      contract.requiresConfirmation ||
      (contract.idempotent && contract.risk !== "read");
    if (needsPreflight) {
      authorization = await runAuthorizationPreflight(env);
    }

    // 5. Replay probe + confirmation gate (fnd-T20 — core.md §5/§7).
    //    A completed idempotency record replays before the single-use
    //    challenge is touched; a failed/stale row with an unexpired
    //    persisted grant resumes without consuming a new token.
    let confirmationGrant: ConfirmationGrant | undefined;
    if (contract.requiresConfirmation) {
      const confirmedAuth = requireAuthorization(authorization, contract.name);
      if (deps.hooks?.confirmation === undefined) {
        throw new CoreInvariantError(
          `"${contract.name}" requires confirmation but no confirmation hook is composed — high-risk execution cannot proceed`,
        );
      }
      const idempotencyHook = deps.hooks.idempotency;
      if (idempotencyHook?.probe !== undefined) {
        const probed = await idempotencyHook.probe({
          ...hookEnv,
          authorization: confirmedAuth,
        });
        if (probed.kind === "replay") {
          const replayedOutput = await contract.output.safeParseAsync(
            probed.response,
          );
          if (!replayedOutput.success) {
            throw new CoreInvariantError(
              `stored idempotent response of "${contract.name}" failed the declared output schema: ${JSON.stringify(replayedOutput.error.issues)}`,
            );
          }
          replayed = true;
          finish("ok");
          return replayedOutput.data;
        }
        if (probed.kind === "resume") {
          confirmationGrant = probed.grant;
        }
      }
      if (confirmationGrant === undefined) {
        confirmationGrant = await deps.hooks.confirmation.gate({
          ...hookEnv,
          authorization: confirmedAuth,
          summarize: bindConfirmationSummary(env, confirmedAuth),
        });
      }
    }

    // 6. Idempotency reserve (slot — fnd-T15), after the confirmation gate.
    if (
      contract.idempotent &&
      contract.risk !== "read" &&
      deps.hooks?.idempotency !== undefined
    ) {
      const outcome = await deps.hooks.idempotency.reserve({
        ...hookEnv,
        authorization: requireAuthorization(authorization, contract.name),
        confirmationGrant,
      });
      if (outcome.kind === "replay") {
        // Replay the stored snapshot without re-running the handler (§5).
        // Re-validation guards the snapshot itself: a stored response that
        // no longer satisfies the schema is a server bug, not client data.
        const replayedOutput = await contract.output.safeParseAsync(
          outcome.response,
        );
        if (!replayedOutput.success) {
          throw new CoreInvariantError(
            `stored idempotent response of "${contract.name}" failed the declared output schema: ${JSON.stringify(replayedOutput.error.issues)}`,
          );
        }
        replayed = true;
        finish("ok");
        return replayedOutput.data;
      }
      reserved = { reservation: outcome.reservation };
    }

    // 7.–9. The execution transaction.
    const output = await deps.db.transaction(
      async (tx) => {
        await applyStatementTimeout(tx, contract.name, deadline - now());
        executionTx = tx;

        // TOCTOU re-authorization (§4 step 7): the principal context is
        // constructed inside this transaction; preflight results are never
        // reused as authority.
        const ctx = await constructPrincipalContext(env, tx);
        executionCtx = ctx;

        const raw = await runWithDeadline({
          run: () => invocation.action.handler(input, ctx),
          deadline,
          now,
          controller,
          actionName: contract.name,
        });

        // 8. Output validation before any commit: a mismatch is a server
        //    bug (`CoreInvariantError`), never a client validation error.
        const parsedOutput = await contract.output.safeParseAsync(raw);
        if (!parsedOutput.success) {
          throw new CoreInvariantError(
            `output of "${contract.name}" failed the declared output schema: ${JSON.stringify(parsedOutput.error.issues)}`,
          );
        }

        // 9. Same-transaction protocol slots: the buffered `ctx.emit`
        //    events insert into the outbox with their per-aggregate
        //    sequences (fnd-T16), then the audit row (fnd-T13) and the
        //    idempotency response snapshot (fnd-T15) — all committing
        //    atomically with the handler's effects.
        //    Audited reads skip the same-tx insert — the read-only tx cannot
        //    write; the row is inserted post-commit (core.md §8).
        await emitBuffer.flush({
          tx,
          ctx,
          causationId: request.causationId ?? request.requestId,
        });
        if (
          contract.audit &&
          contract.risk !== "read" &&
          deps.hooks?.audit !== undefined
        ) {
          await deps.hooks.audit.recordSuccess({
            tx,
            ctx,
            contract,
            input,
            output: parsedOutput.data,
            durationMs: now() - startedAt,
            auditTarget: requireAuditTarget(env),
            auditSnapshot: invocation.action.auditSnapshot,
          });
        }
        if (reserved !== undefined && deps.hooks?.idempotency !== undefined) {
          await deps.hooks.idempotency.finalize({
            tx,
            reservation: reserved.reservation,
            output: parsedOutput.data,
          });
        }

        return parsedOutput.data;
      },
      // 10. Commit — and the database-level read-only mode for reads, so a
      //     runtime write fails even if a capability facade were sidestepped.
      { accessMode: contract.risk === "read" ? "read only" : "read write" },
    );
    executionTx = undefined;

    // Post-commit audit for audited reads: the handler transaction is
    // read-only so the row is written in a separate short transaction.
    // Best-effort: a failure here is logged but never masks the response
    // (core.md §8 — audited reads).
    const auditHook = deps.hooks?.audit;
    if (
      contract.audit &&
      contract.risk === "read" &&
      auditHook !== undefined &&
      executionCtx !== undefined
    ) {
      const ctx = executionCtx;
      try {
        await deps.db.transaction(async (auditTx) => {
          await auditHook.recordSuccess({
            tx: auditTx,
            ctx,
            contract,
            input: validatedInput,
            output,
            durationMs: now() - startedAt,
            auditTarget: requireAuditTarget(env),
            auditSnapshot: invocation.action.auditSnapshot,
          });
        });
      } catch (auditError) {
        log.error({ err: auditError }, "post-commit read audit failed");
      }
    }

    finish("ok");
    return output;
  } catch (error) {
    executionTx = undefined;
    const coreError = toCoreError(error, contract.name);

    // Failure path (§4 step 10): the execution transaction has rolled back
    // (handler writes, outbox, audit, finalization). Record the outcome in
    // separate short transactions owned by the hooks; a broken hook must
    // not mask the original failure.
    if (reserved !== undefined && deps.hooks?.idempotency !== undefined) {
      try {
        await deps.hooks.idempotency.markFailed({
          reservation: reserved.reservation,
          error: coreError,
        });
      } catch (hookError) {
        log.error({ err: hookError }, "idempotency markFailed hook failed");
      }
    }
    if (contract.audit && deps.hooks?.audit !== undefined) {
      try {
        await deps.hooks.audit.recordFailure({
          contract,
          request,
          principal,
          // Validated when step 1 succeeded; the raw input never reaches
          // hooks (they must not hash/store unvalidated payloads).
          input: validatedInput,
          authorization,
          error: coreError,
          durationMs: now() - startedAt,
          auditTarget: invocation.action.auditTarget,
        });
      } catch (hookError) {
        log.error({ err: hookError }, "audit recordFailure hook failed");
      }
    }

    span?.recordError(coreError);
    finish(coreError.code);
    throw coreError;
  }
}

/**
 * Protocol hooks are optional on `PipelineDeps` so tests can compose
 * subsets, but an action that declares a protocol cannot execute when
 * that slice is missing (core.md §5/§7/§8/§10). Confirmation already
 * failed closed; the other three protocols follow the same rule.
 */
function assertRequiredProtocolHooks(
  contract: AnyActionContract,
  hooks: ActionPipelineDeps["hooks"],
): void {
  if (contract.principal !== "system" && hooks?.rateLimit === undefined) {
    throw new CoreInvariantError(
      `"${contract.name}" is a non-system action but no rate-limit hook is composed`,
    );
  }
  if (
    contract.idempotent &&
    contract.risk !== "read" &&
    hooks?.idempotency === undefined
  ) {
    throw new CoreInvariantError(
      `"${contract.name}" is an idempotent mutation but no idempotency hook is composed`,
    );
  }
  if (contract.audit && hooks?.audit === undefined) {
    throw new CoreInvariantError(
      `"${contract.name}" declares audit: true but no audit hook is composed`,
    );
  }
  if (contract.requiresConfirmation && hooks?.confirmation === undefined) {
    throw new CoreInvariantError(
      `"${contract.name}" requires confirmation but no confirmation hook is composed — high-risk execution cannot proceed`,
    );
  }
}

/** Transport/enqueuing composition must match the declared metadata. */
function assertPrincipalShape(
  contract: AnyActionContract,
  principal: PrincipalInvocation,
): void {
  if (principal.mode !== contract.principal) {
    throw new CoreInvariantError(
      `action "${contract.name}" declares principal "${contract.principal}" but was invoked as "${principal.mode}" — transport composition bug`,
    );
  }
  if (
    principal.mode === "system" &&
    principal.scope.scope !== contract.systemScope
  ) {
    throw new CoreInvariantError(
      `system action "${contract.name}" declares systemScope "${contract.systemScope ?? "<missing>"}" but was enqueued with scope "${principal.scope.scope}"`,
    );
  }
}

/**
 * Step 2: session presence for the modes that require authentication. The
 * factories repeat this in-transaction as defense in depth; failing here
 * keeps rate limiting and preflight behind authentication (§4 order).
 */
function assertAuthenticated(principal: PrincipalInvocation): void {
  if (principal.mode === "public" || principal.mode === "system") {
    return;
  }
  if (principal.session === null) {
    throw new PermissionDeniedError("Authentication required.", {
      internalMessage: `${principal.mode} action invoked without a session`,
    });
  }
}

function requireResolver<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TTarget,
>(env: RunEnv<TInput, TOutput, TTarget>): TargetResolver<TInput, TTarget> {
  const resolver = env.action.resolveTarget;
  if (resolver === undefined) {
    throw new CoreInvariantError(
      `action "${env.contract.name}" requires a target resolver but none is bound — implementAction should have rejected this pairing`,
    );
  }
  return resolver;
}

function requireAuditTarget<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TTarget,
>(env: RunEnv<TInput, TOutput, TTarget>): AuditTargetFn {
  const target = env.action.auditTarget;
  if (target === undefined) {
    throw new CoreInvariantError(
      `action "${env.contract.name}" declares audit: true but binds no auditTarget — implementAction should have rejected this pairing`,
    );
  }
  return target;
}

function requireAuthorization(
  authorization: PreflightAuthorization | undefined,
  actionName: string,
): PreflightAuthorization {
  if (authorization === undefined) {
    throw new CoreInvariantError(
      `"${actionName}" reached a confirmation/idempotency hook without an authorization preflight — contract metadata allowed a mode that cannot carry these protocols`,
    );
  }
  return authorization;
}

function bindConfirmationSummary<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TTarget,
>(
  env: RunEnv<TInput, TOutput, TTarget>,
  authorization: PreflightAuthorization,
): () => MaybePromise<string> {
  const summarize = env.action.confirmationSummary;
  if (summarize === undefined) {
    throw new CoreInvariantError(
      `action "${env.contract.name}" requires confirmation but binds no confirmationSummary — implementAction should have rejected this pairing`,
    );
  }
  const summaryEnv: ConfirmationSummaryEnv = {
    companyId: authorization.companyId,
    ...(authorization.target !== undefined
      ? { target: authorization.target }
      : {}),
  };
  return () => summarize(env.input, summaryEnv);
}

/**
 * Step 4: verify membership (staff) or run the typed resolver (customer;
 * public-target never carries these protocols) in a short read-only
 * transaction; account verifies only session validity; a system identity
 * is trusted enqueuing-code input. Consumer/public-global cannot get here
 * with a validated contract (read-only, no confirmation/idempotency).
 */
async function runAuthorizationPreflight<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TTarget,
>(
  env: RunEnv<TInput, TOutput, TTarget>,
): Promise<PreflightAuthorization | undefined> {
  const { deps, request, principal } = env;
  switch (principal.mode) {
    case "staff":
      return await deps.db.transaction(
        async (tx) => {
          const ctx = await createStaffContext({
            request,
            runtime: env.makeRuntime(createReadTx(tx)),
            session: principal.session,
            companySelector: principal.companySelector,
          });
          assertDeclaredPermissions(ctx.membership, env.contract);
          return { actor: ctx.actor, companyId: ctx.companyId };
        },
        { accessMode: "read only" },
      );
    case "customer":
      return await deps.db.transaction(
        async (tx) => {
          const ctx = await createCustomerContext({
            request,
            runtime: env.makeRuntime(createReadTx(tx)),
            session: principal.session,
            input: env.input,
            resolveTarget: requireResolver(env),
          });
          return {
            actor: ctx.actor,
            companyId: ctx.target.companyId,
            target: ctx.target.resource,
          };
        },
        { accessMode: "read only" },
      );
    case "account": {
      // No membership or target exists to verify (§4 step 4); the own-user
      // boundary is enforced by the handler and inherited tests.
      const session = principal.session;
      if (session === null) {
        throw new PermissionDeniedError("Authentication required.", {
          internalMessage: "account action invoked without a session",
        });
      }
      return {
        actor: { type: "user", id: session.userId },
        companyId: null,
      };
    }
    case "system":
      return {
        actor: { type: "system", id: principal.serviceName },
        companyId:
          principal.scope.scope === "tenant" ? principal.scope.companyId : null,
      };
    case "public":
    case "consumer":
      return undefined;
  }
}

/**
 * Step 7: construct the principal context **inside** the execution
 * transaction — membership/target authorization re-runs here to prevent
 * TOCTOU, and the DB capability matches the declared risk: `ReadTx` for
 * reads, the writable transaction otherwise, and the grant-bound
 * `ProjectionReadTx` for public-global (built by the factory).
 */
async function constructPrincipalContext<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TTarget,
>(env: RunEnv<TInput, TOutput, TTarget>, tx: Tx): Promise<ActionCtx> {
  const { contract, request, principal } = env;
  const capability: ReadTx | Tx =
    contract.risk === "read" ? createReadTx(tx) : tx;
  switch (principal.mode) {
    case "staff": {
      const ctx = await createStaffContext({
        request,
        runtime: env.makeRuntime(capability),
        session: principal.session,
        companySelector: principal.companySelector,
      });
      assertDeclaredPermissions(ctx.membership, contract);
      return ctx;
    }
    case "customer":
      return await createCustomerContext({
        request,
        runtime: env.makeRuntime(capability),
        session: principal.session,
        input: env.input,
        resolveTarget: requireResolver(env),
      });
    case "public": {
      if (contract.publicScope === "globalProjection") {
        const grantId = contract.projectionGrant;
        const manifest = env.deps.projectionGrants ?? runtimeProjectionGrants;
        const grant = grantId !== undefined ? manifest.get(grantId) : undefined;
        if (grant === undefined) {
          throw new CoreInvariantError(
            `public-global action "${contract.name}" references projection grant "${grantId ?? "<missing>"}" which is not in the runtime manifest`,
          );
        }
        return await createPublicContext({
          request,
          runtime: env.makeRuntime<ReadTx>(capability),
          publicScope: "globalProjection",
          grant,
        });
      }
      return await createPublicContext({
        request,
        runtime: env.makeRuntime<ReadTx>(capability),
        publicScope: "target",
        input: env.input,
        resolveTarget: requireResolver(env),
      });
    }
    case "system":
      return createSystemContext(principal.serviceName, principal.scope, {
        request,
        runtime: env.makeRuntime(capability),
      });
    case "consumer":
      return createConsumerContext({
        request,
        runtime: env.makeRuntime<ReadTx>(capability),
        session: principal.session,
      });
    case "account":
      return createAccountContext({
        request,
        runtime: env.makeRuntime(capability),
        session: principal.session,
      });
  }
}

/**
 * Transaction-local statement timeout sized to the remaining deadline, so
 * a query that ignores the abort signal is still bounded by the database.
 */
async function applyStatementTimeout(
  tx: Tx,
  actionName: string,
  remainingMs: number,
): Promise<void> {
  if (remainingMs <= 0) {
    throw new TimeoutError(undefined, {
      internalMessage: `deadline of "${actionName}" was exhausted before the execution transaction could start`,
    });
  }
  // Integral milliseconds by construction — the interpolation cannot inject.
  const budgetMs = Math.max(1, Math.ceil(remainingMs));
  // Raw SQL approved by core.md §4 ("set the transaction-local DB statement
  // timeout"): SET LOCAL accepts no bind parameters and Drizzle has no
  // dedicated API for it.
  await tx.execute(
    sql.raw(`SET LOCAL statement_timeout = ${String(budgetMs)}`),
  );
}

/**
 * Races the handler against the remaining deadline. On expiry the shared
 * abort signal fires (well-behaved handlers observe it) and the pipeline
 * throws `TimeoutError`, rolling the transaction back; whatever ignores
 * the signal is bounded by the statement timeout.
 */
async function runWithDeadline<T>(options: {
  readonly run: () => Promise<T>;
  readonly deadline: number;
  readonly now: () => number;
  readonly controller: AbortController;
  readonly actionName: string;
}): Promise<T> {
  const remaining = options.deadline - options.now();
  if (remaining <= 0) {
    const timeout = new TimeoutError(undefined, {
      internalMessage: `deadline of "${options.actionName}" was exhausted before the handler started`,
    });
    options.controller.abort(timeout);
    throw timeout;
  }
  let timer: NodeJS.Timeout | undefined;
  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const timeout = new TimeoutError(undefined, {
        internalMessage: `handler of "${options.actionName}" exceeded the whole-pipeline deadline`,
      });
      options.controller.abort(timeout);
      reject(timeout);
    }, remaining);
  });
  try {
    return await Promise.race([options.run(), expiry]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Everything leaving the pipeline is a typed core error (§11). A throw
 * outside the vocabulary is a server bug by definition — domain code must
 * use `@showzy/core/errors` (prohibitions.mdc).
 */
function toCoreError(error: unknown, actionName: string): CoreError {
  if (error instanceof CoreError) {
    return error;
  }
  return new CoreInvariantError(
    `action "${actionName}" threw outside the typed error vocabulary`,
    { cause: error },
  );
}
