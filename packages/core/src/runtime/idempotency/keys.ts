/**
 * Shared identity helpers for the idempotency protocol (core.md §5) and the
 * confirmation protocol (core.md §7). Both must use the same principal and
 * scope keys: a challenge is bound to the reservation it will later resume.
 */
import type { z } from "zod";

import { CoreInvariantError, ValidationError } from "../../errors/index.js";
import type {
  PipelineHookEnv,
  PreflightAuthorization,
} from "../pipeline/types.js";

export type ProtocolIdentityEnv = PipelineHookEnv & {
  readonly authorization: PreflightAuthorization;
};

/**
 * The key is transport meta (contract.md §3), so no action schema parses
 * it — a hand-built issue keeps the wire shape `VALIDATION`. Never
 * generated server-side: the server cannot infer a logical submit (§5).
 */
export function requireIdempotencyKey(env: {
  readonly contract: { readonly name: string };
  readonly request: { readonly idempotencyKey?: string };
}): string {
  const key = env.request.idempotencyKey;
  if (key !== undefined && key !== "") {
    return key;
  }
  const issue: z.core.$ZodIssue = {
    code: "custom",
    path: ["idempotencyKey"],
    message: "An idempotency key is required for this action.",
    input: key,
  };
  throw new ValidationError(
    [issue],
    "An idempotency key is required for this action.",
    {
      internalMessage: `idempotent mutation "${env.contract.name}" invoked without an idempotency key`,
    },
  );
}

/**
 * Mode + accountable identity (§5). Consumer and public modes never reach
 * a confirmation/idempotency hook: their contracts are read-only by the
 * contract-check rules, and the pipeline gates both protocols on
 * `risk !== "read"`.
 */
export function principalKeyFor(env: ProtocolIdentityEnv): string {
  const actor = env.authorization.actor;
  switch (env.principal.mode) {
    case "staff":
    case "customer":
    case "account":
      if (actor.type !== "user") {
        throw new CoreInvariantError(
          `${env.principal.mode} authorization for "${env.contract.name}" carries a non-user actor "${actor.type}"`,
        );
      }
      return `${env.principal.mode}:${actor.id}`;
    case "system":
      return `system:${env.principal.serviceName}`;
    case "consumer":
    case "public":
      throw new CoreInvariantError(
        `"${env.contract.name}" reached a confirmation/idempotency hook as "${env.principal.mode}" — the contract check must reject these protocols for this mode`,
      );
  }
}

/**
 * `company:<effectiveCompanyId>` for every tenant-scoped action,
 * `user:<userId>` for account actions, `global` only for a declared global
 * system action (§5). Staff/customer without a company cannot happen — the
 * preflight verified membership/target.
 */
export function scopeKeyFor(
  env: ProtocolIdentityEnv,
  principalKey: string,
): string {
  if (env.principal.mode === "account") {
    return `user:${env.authorization.actor.id}`;
  }
  if (env.authorization.companyId !== null) {
    return `company:${env.authorization.companyId}`;
  }
  if (env.principal.mode === "system") {
    return "global";
  }
  throw new CoreInvariantError(
    `"${env.contract.name}" (${principalKey}) has no company scope and is not an account or global system action`,
  );
}
