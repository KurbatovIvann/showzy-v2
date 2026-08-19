/**
 * The per-request transport context and its translation into pipeline
 * shapes (contract.md §3). `apps/api` (fnd-T26) resolves the better-auth
 * session, normalizes the trusted-proxy IP, and reads the meta headers —
 * this module decides what each principal mode is allowed to see of that,
 * so a transport cannot accidentally hand tenant authority to a mode that
 * must not have it.
 */
import type {
  ActionChannel,
  AnyActionContract,
  PipelineRequestMeta,
  PrincipalInvocation,
  SessionPrincipal,
} from "@showzy/core";

import { ContractCompositionError } from "../client/contract-router.js";

/**
 * What one HTTP invocation resolved to before dispatch. Selectors and
 * sessions are lookup keys here — authority is established by the core
 * context factories inside the pipeline (core.md §3).
 */
export interface TransportInvocationContext {
  readonly requestId: string;
  readonly channel: ActionChannel;
  /** `null` for anonymous requests; the 401 gate is the transport's job. */
  readonly session: SessionPrincipal | null;
  /** Raw `x-company-id` header value; `null` when absent (ADR-0013). */
  readonly companySelector: string | null;
  /** Trusted-proxy normalized; required by public/share/consumer/account. */
  readonly clientIp?: string;
  /** `idempotency-key` header/meta (core.md §5) — never action input. */
  readonly idempotencyKey?: string;
  /** Confirmation challenge meta (core.md §7) — never action input. */
  readonly confirmationChallengeId?: string;
  readonly aiTraceId?: string;
  readonly toolCallId?: string;
}

/**
 * Request meta for the pipeline. An edge invocation starts its own
 * correlation chain: `correlationId` and `causationId` default to the
 * request id (core.md §6) — only the event-delivery entrypoint overrides
 * causation.
 */
export function toPipelineRequestMeta(
  context: TransportInvocationContext,
): PipelineRequestMeta {
  return {
    requestId: context.requestId,
    correlationId: context.requestId,
    channel: context.channel,
    ...(context.clientIp !== undefined ? { clientIp: context.clientIp } : {}),
    ...(context.aiTraceId !== undefined
      ? { aiTraceId: context.aiTraceId }
      : {}),
    ...(context.toolCallId !== undefined
      ? { toolCallId: context.toolCallId }
      : {}),
    ...(context.idempotencyKey !== undefined
      ? { idempotencyKey: context.idempotencyKey }
      : {}),
    ...(context.confirmationChallengeId !== undefined
      ? { confirmationChallengeId: context.confirmationChallengeId }
      : {}),
  };
}

/**
 * Maps the transport context onto the declared principal mode. What each
 * mode receives is deliberate:
 *
 * - `staff` gets the session and the raw selector — core verifies the
 *   selector against membership; it is never authority (ADR-0013).
 * - `customer` gets only the session; company scope comes from the typed
 *   resolver.
 * - `public` gets nothing: neither session nor selector reaches the
 *   pipeline — tenant scope comes from the target resolver or the
 *   declared projection grant, never from transport meta (ADR-0020).
 * - `share` gets nothing: neither session nor selector. The capability
 *   token is action input, never a header (ADR-0022). A present session
 *   is ignored and grants no extra access.
 * - `consumer`/`account` get only the session: a present `x-company-id`
 *   is ignored and grants no company scope (ADR-0018, ADR-0013).
 * - `system` is unreachable — system actions are `transport: "internal"`
 *   and never routable; hitting this branch is a composition bug.
 */
export function toPrincipalInvocation(
  contract: AnyActionContract,
  context: TransportInvocationContext,
): PrincipalInvocation {
  switch (contract.principal) {
    case "staff":
      return {
        mode: "staff",
        session: context.session,
        companySelector: context.companySelector,
      };
    case "customer":
      return { mode: "customer", session: context.session };
    case "public":
      return { mode: "public" };
    case "consumer":
      return { mode: "consumer", session: context.session };
    case "account":
      return { mode: "account", session: context.session };
    case "share":
      return { mode: "share" };
    case "system":
      throw new ContractCompositionError([
        `action "${contract.name}" declares principal "system" — system actions are transport: "internal" and never routable (contract.md §2)`,
      ]);
  }
}
