/**
 * Execution-pipeline surfaces (fnd-T12 — core.md §4): the invocation shape
 * transports hand to `executeAction`, the protocol hook slots later
 * foundation tasks fill (audit fnd-T13, rate limiting fnd-T14, idempotency
 * fnd-T15, confirmation fnd-T20), and the telemetry sink the apps bind to
 * OTel/Sentry (fnd-T26/T28).
 *
 * The hooks are optional injection points on purpose: the pipeline commits
 * the fixed §4 step order and the transaction semantics here, while each
 * protocol's storage/validation logic lands with its own task and plugs
 * into its slot without reordering anything. An absent hook means "this
 * protocol slice has not landed yet" — apps compose the full set at boot,
 * and the contract check keeps actions honest about what they declare.
 */
import type { Database, ProjectionGrantManifest, Tx } from "@showzy/db";
import type { Logger } from "pino";

import type { CoreError } from "../../errors/index.js";
import type { AnyActionContract } from "../action-registry.js";
import type {
  ActionRequestMeta,
  SessionPrincipal,
  SystemScopeInput,
} from "../context/factories.js";
import type {
  ActionActor,
  ActionChannel,
  ActionCtx,
} from "../context/types.js";
import type { z } from "zod";

import type { AuditSnapshotFn, AuditTargetFn, MaybePromise } from "../types.js";

/**
 * Request-scoped metadata the transport supplies. The pipeline derives the
 * full `ActionRequestMeta` by adding the action name from the contract —
 * a transport never names the action twice.
 */
export interface PipelineRequestMeta {
  readonly requestId: string;
  /** Propagated across `ctx.call` and events; equals `requestId` at the edge. */
  readonly correlationId: string;
  /**
   * The eventId or requestId that caused this invocation (core.md §6):
   * events emitted here carry it as their envelope `causationId`. Omitted
   * at the edge (defaults to `requestId`); the event-delivery entrypoint
   * (fnd-T17) sets the delivered event's id.
   */
  readonly causationId?: string;
  readonly channel: ActionChannel;
  /** Trusted-proxy normalized; required by public/consumer/account modes. */
  readonly clientIp?: string;
  readonly aiTraceId?: string;
  readonly toolCallId?: string;
  /**
   * Caller-supplied idempotency key (oRPC meta/header — contract.md §3).
   * Consumed by the idempotency hook (fnd-T15); never part of action input.
   */
  readonly idempotencyKey?: string;
  /**
   * Confirmation challenge reference from transport meta (contract.md §3;
   * core.md §7). Consumed by the confirmation hook (fnd-T20); carrying it
   * as meta keeps it out of the canonical input hash.
   */
  readonly confirmationChallengeId?: string;
}

/**
 * Who is invoking, per mode — the pipeline authenticates this against the
 * contract's declared principal and hands the pieces to the matching
 * context factory. Selectors and sessions are lookup keys here; authority
 * is established by the factories inside the transactions (core.md §3).
 */
export type PrincipalInvocation =
  | {
      readonly mode: "staff";
      readonly session: SessionPrincipal | null;
      /** Raw `x-company-id` header value; `null` when absent. */
      readonly companySelector: string | null;
    }
  | { readonly mode: "customer"; readonly session: SessionPrincipal | null }
  | { readonly mode: "public" }
  | {
      readonly mode: "system";
      readonly serviceName: string;
      readonly scope: SystemScopeInput;
    }
  | { readonly mode: "consumer"; readonly session: SessionPrincipal | null }
  | { readonly mode: "account"; readonly session: SessionPrincipal | null };

/**
 * What the authorization preflight (§4 step 4) proved, distilled for the
 * confirmation/idempotency hooks: the accountable actor and the resolved
 * company scope. Never a substitute for the in-transaction re-authorization
 * — it only prevents unauthorized challenges/idempotency rows.
 */
export interface PreflightAuthorization {
  readonly actor: ActionActor;
  readonly companyId: string | null;
}

/**
 * Request meta as protocol hooks see it: the correlation fields plus the
 * protocol transport meta (contract.md §3) — carried as oRPC meta/headers,
 * never as action input, so it cannot change the canonical input hash.
 */
export interface PipelineHookRequestMeta extends ActionRequestMeta {
  readonly causationId?: string;
  readonly idempotencyKey?: string;
  readonly confirmationChallengeId?: string;
}

/** Fields every protocol hook receives about the current invocation. */
export interface PipelineHookEnv {
  readonly contract: AnyActionContract;
  readonly request: PipelineHookRequestMeta;
  readonly principal: PrincipalInvocation;
  /** Zod-validated action input (§4 step 1 has already run). */
  readonly input: unknown;
}

/** Filled by fnd-T14 (core.md §10). Throws `RateLimitError` when exhausted. */
export interface RateLimitHook {
  enforce(env: PipelineHookEnv): Promise<void>;
}

/**
 * Filled by fnd-T20 (core.md §7). Runs after the authorization preflight
 * and before the idempotency reserve: issues `ConfirmationRequiredError`
 * on the first invocation, validates/consumes the challenge on the second.
 */
export interface ConfirmationHook {
  gate(
    env: PipelineHookEnv & {
      readonly authorization: PreflightAuthorization;
      /** The action's `confirmationSummary`, bound to the validated input. */
      readonly summarize: () => MaybePromise<string>;
    },
  ): Promise<void>;
}

/** Outcome of the idempotency reserve step (core.md §5). */
export type IdempotencyReserveResult =
  | {
      readonly kind: "execute";
      /** Opaque reservation, handed back to `finalize`/`markFailed`. */
      readonly reservation: unknown;
    }
  | {
      readonly kind: "replay";
      /** The stored response snapshot of the completed prior attempt. */
      readonly response: unknown;
    };

/**
 * Filled by fnd-T15 (core.md §5). `reserve` runs in its own short
 * transaction before the handler; `finalize` runs **inside** the handler
 * transaction so the response snapshot commits atomically with the
 * effects; `markFailed` runs in a separate transaction after rollback.
 */
export interface IdempotencyHook {
  reserve(
    env: PipelineHookEnv & { readonly authorization: PreflightAuthorization },
  ): Promise<IdempotencyReserveResult>;
  finalize(env: {
    readonly tx: Tx;
    readonly reservation: unknown;
    /** The Zod-validated, JSON-safe response snapshot to store. */
    readonly output: unknown;
  }): Promise<void>;
  markFailed(env: {
    readonly reservation: unknown;
    readonly error: CoreError;
  }): Promise<void>;
}

/**
 * Filled by fnd-T13 (core.md §8). `recordSuccess` runs inside the handler
 * transaction (mutations) or in a separate short transaction after the
 * read-only handler transaction commits (`risk: read`); `recordFailure`
 * runs after rollback in its own transaction and receives whatever identity
 * the pipeline had established when the invocation failed.
 */
export interface AuditHook {
  recordSuccess(env: {
    readonly tx: Tx;
    readonly ctx: ActionCtx;
    readonly contract: AnyActionContract;
    readonly input: unknown;
    readonly output: unknown;
    readonly durationMs: number;
    readonly auditTarget: AuditTargetFn;
    readonly auditSnapshot: AuditSnapshotFn<z.ZodType> | undefined;
  }): Promise<void>;
  recordFailure(
    env: PipelineHookEnv & {
      readonly error: CoreError;
      readonly authorization: PreflightAuthorization | undefined;
      readonly durationMs: number;
      readonly auditTarget: AuditTargetFn | undefined;
    },
  ): Promise<void>;
}

/** The protocol slots, composed at boot. Order of execution is fixed (§4). */
export interface PipelineHooks {
  readonly rateLimit?: RateLimitHook;
  readonly confirmation?: ConfirmationHook;
  readonly idempotency?: IdempotencyHook;
  readonly audit?: AuditHook;
}

/** Correlation fields opening one action span (blueprint §9). */
export interface ActionSpanFields {
  readonly requestId: string;
  readonly correlationId: string;
  readonly action: string;
  readonly channel: ActionChannel;
  readonly aiTraceId?: string;
  readonly toolCallId?: string;
}

/** Resolved identity/outcome fields closing the span. */
export interface ActionSpanOutcome {
  readonly outcome: string;
  readonly actorType: string | null;
  readonly actorId: string | null;
  readonly companyId: string | null;
  readonly durationMs: number;
}

export interface ActionSpan {
  /** Failure detail for Sentry, correlated by the span's fields. */
  recordError(error: unknown): void;
  end(outcome: ActionSpanOutcome): void;
}

/**
 * The OTel/Sentry seam. Core stays dependency-free: `apps/api` and
 * `apps/worker` bind this to real tracers/Sentry clients (fnd-T26/T28)
 * with the same correlation fields the structured log lines carry.
 */
export interface ActionTelemetry {
  startSpan(fields: ActionSpanFields): ActionSpan;
}

/** Process-lifetime dependencies of the pipeline, composed once at boot. */
export interface ActionPipelineDeps {
  readonly db: Database;
  readonly logger: Logger;
  /** Defaults to the runtime manifest exported by `@showzy/db`. */
  readonly projectionGrants?: ProjectionGrantManifest;
  readonly hooks?: PipelineHooks;
  readonly telemetry?: ActionTelemetry;
  /** Clock override for tests; defaults to `Date.now`. */
  readonly now?: () => number;
}
