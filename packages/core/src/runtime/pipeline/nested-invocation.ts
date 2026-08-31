/**
 * Shared machinery of the two nested invocation channels (core.md §9):
 * `ctx.call` (fnd-T19 — synchronous cross-module reads) and
 * `ctx.callAtomic` (fnd-T19A — the one declared same-transaction write
 * edge, ADR-0021). Owns what the channels share verbatim — callee
 * input/output validation, the shared-deadline guard, the
 * correlation-nested log/span/finish trio, and error attribution — while
 * the distinct transaction semantics stay with the callers: `ctx.call`
 * hands the callee a `ReadTx` facade over the caller's transaction,
 * `ctx.callAtomic` hands the writable root `Tx` on as-is.
 */
import type { Logger } from "pino";
import type { z } from "zod";

import {
  CoreError,
  CoreInvariantError,
  TimeoutError,
  ValidationError,
} from "../../errors/index.js";
import {
  effectiveCompanyId,
  type ActionRequestMeta,
} from "../context/factories.js";
import type { ActionCtx } from "../context/types.js";
import type { ImplementedAction } from "../implement-action.js";
import type { AuditTargetFn } from "../types.js";
import type { ActionPipelineDeps } from "./types.js";

/** Names one channel in every shared log line and error message. */
export interface NestedInvocationKind {
  /** The log/error noun — "nested call started", "atomic call target …". */
  readonly noun: "nested call" | "atomic call";
  /** The invoker in chain messages — "ctx.call A → B attempted after …". */
  readonly invoker: "ctx.call" | "ctx.callAtomic";
}

export const NESTED_CALL: NestedInvocationKind = {
  noun: "nested call",
  invoker: "ctx.call",
};

export const ATOMIC_CALL: NestedInvocationKind = {
  noun: "atomic call",
  invoker: "ctx.callAtomic",
};

/**
 * Shared timeout budget (§9): a caller at/past its deadline cannot start
 * nested work; the abort signal and the caller's transaction-local
 * statement timeout bound whatever is already running.
 */
export function assertNestedDeadline(options: {
  readonly kind: NestedInvocationKind;
  readonly chain: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
  readonly now: () => number;
}): void {
  if (options.signal.aborted || options.deadline - options.now() <= 0) {
    throw new TimeoutError(undefined, {
      internalMessage: `${options.kind.invoker} ${options.chain} attempted after the shared deadline was exhausted`,
    });
  }
}

/**
 * Callee input validation — the same rule as pipeline step 1. Callers may
 * pass user-derived values through, so a mismatch stays a client-safe
 * ValidationError, not an invariant failure. (Parsed via the schema the
 * caller reads off `action.contract`, keeping the generics the widened
 * callee contract erases.)
 */
export async function validateNestedInput<TInput extends z.ZodType>(options: {
  readonly kind: NestedInvocationKind;
  readonly schema: TInput;
  readonly input: unknown;
  readonly chain: string;
}): Promise<z.output<TInput>> {
  const parsed = await options.schema.safeParseAsync(options.input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues, "Input validation failed.", {
      internalMessage: `input of ${options.kind.noun} ${options.chain} failed the callee's declared input schema`,
    });
  }
  return parsed.data;
}

/** Callee output validation — a mismatch is a server bug, like §4 step 8. */
export async function validateNestedOutput<TOutput extends z.ZodType>(options: {
  readonly kind: NestedInvocationKind;
  readonly schema: TOutput;
  readonly calleeName: string;
  readonly raw: unknown;
}): Promise<z.output<TOutput>> {
  const parsed = await options.schema.safeParseAsync(options.raw);
  if (!parsed.success) {
    throw new CoreInvariantError(
      `output of ${options.kind.noun} "${options.calleeName}" failed the declared output schema: ${JSON.stringify(parsed.error.issues)}`,
    );
  }
  return parsed.data;
}

/** The started log line, child logger, span, and finish/error recorders. */
export interface NestedInvocationTelemetry {
  /** The caller's request meta with the callee's action name swapped in. */
  readonly request: ActionRequestMeta;
  readonly log: Logger;
  readonly startedAt: number;
  finish(outcome: string, calleeCtx: ActionCtx | undefined): void;
  recordError(error: unknown): void;
}

/**
 * Correlation-nested logs/spans (§9): same request/correlation ids, the
 * callee's action name, and the caller for attribution. Emits the started
 * line; `finish` emits the finished line (error level for `INTERNAL`) and
 * ends the span with whatever callee identity was constructed.
 */
export function startNestedInvocation(options: {
  readonly kind: NestedInvocationKind;
  readonly deps: ActionPipelineDeps;
  /** The caller's request meta; correlation fields propagate unchanged. */
  readonly callerRequest: ActionRequestMeta;
  readonly callerName: string;
  readonly calleeName: string;
  readonly now: () => number;
}): NestedInvocationTelemetry {
  const startedAt = options.now();
  const request: ActionRequestMeta = {
    ...options.callerRequest,
    action: options.calleeName,
  };
  const log = options.deps.logger.child({
    request_id: request.requestId,
    correlation_id: request.correlationId,
    action: options.calleeName,
    caller_action: options.callerName,
    channel: request.channel,
  });
  const span = options.deps.telemetry?.startSpan({
    requestId: request.requestId,
    correlationId: request.correlationId,
    action: options.calleeName,
    channel: request.channel,
    ...(request.aiTraceId !== undefined
      ? { aiTraceId: request.aiTraceId }
      : {}),
    ...(request.toolCallId !== undefined
      ? { toolCallId: request.toolCallId }
      : {}),
  });
  log.info(`${options.kind.noun} started`);

  return {
    request,
    log,
    startedAt,
    finish: (outcome, calleeCtx) => {
      const durationMs = options.now() - startedAt;
      const identity = {
        actorType: calleeCtx?.actor.type ?? null,
        actorId: calleeCtx?.actor.id ?? null,
        companyId:
          calleeCtx !== undefined ? effectiveCompanyId(calleeCtx) : null,
      };
      const fields = {
        actor_type: identity.actorType,
        actor_id: identity.actorId,
        company_id: identity.companyId,
        outcome,
        duration_ms: durationMs,
      };
      if (outcome === "INTERNAL") {
        log.error(fields, `${options.kind.noun} finished`);
      } else {
        log.info(fields, `${options.kind.noun} finished`);
      }
      span?.end({ outcome, ...identity, durationMs });
    },
    recordError: (error) => {
      span?.recordError(error);
    },
  };
}

/**
 * Everything leaving a nested invocation is a typed core error (§11),
 * attributed to the callee so the log trail names the module that broke
 * the rule.
 */
export function toNestedInvocationError(
  kind: NestedInvocationKind,
  error: unknown,
  calleeName: string,
): CoreError {
  if (error instanceof CoreError) {
    return error;
  }
  return new CoreInvariantError(
    `${kind.noun} target "${calleeName}" threw outside the typed error vocabulary`,
    { cause: error },
  );
}

/** The audit-target pairing `implementAction` guarantees, re-asserted. */
export function requireNestedAuditTarget<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TTarget,
>(
  kind: NestedInvocationKind,
  action: ImplementedAction<TInput, TOutput, TTarget>,
): AuditTargetFn {
  const target = action.auditTarget;
  if (target === undefined) {
    throw new CoreInvariantError(
      `${kind.noun} target "${action.contract.name}" declares audit: true but binds no auditTarget — implementAction should have rejected this pairing`,
    );
  }
  return target;
}
