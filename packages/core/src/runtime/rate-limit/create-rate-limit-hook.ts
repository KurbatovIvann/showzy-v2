/**
 * `createRateLimitHook` — the fnd-T14 rate-limiting protocol (core.md §10).
 *
 * One token bucket per `(action, scope key)`. Defaults per principal:
 * `public` 30/min per rotating HMAC of the trusted-proxy-normalized IP,
 * `consumer` 60/min per user, `account` 90/min per user, `customer`/`staff`
 * 120/min per user, `system` unlimited. Actions override via the contract's
 * `rateLimit` field. Exceeded → `RateLimitError` with `retryAfterSec`.
 *
 * Store failure splits by action class: fail-closed for public and for
 * every mutation (`draft`/`write`/`high`), fail-open with an error log for
 * ordinary authenticated reads and for system actions (workers must not
 * stall on Redis). An owning spec may declare a `rateLimit` override for
 * the bucket; store-failure policy for system stays fail-open (core.md §10).
 *
 * The raw client IP never leaves the transport layer: the bucket key for
 * public traffic is an HMAC whose input includes a rotation-window index,
 * so keys are not linkable to an address and stop being linkable to each
 * other across windows. Nothing here logs the IP or the key.
 */
import { createHmac } from "node:crypto";

import type { Logger } from "pino";

import type { ActionPrincipal, ActionRateLimit } from "../../contract/types.js";
import { CoreInvariantError, RateLimitError } from "../../errors/index.js";
import type { PipelineHookEnv, RateLimitHook } from "../pipeline/types.js";
import type { RateLimitStore } from "./token-bucket.js";

/**
 * The core.md §10 principal defaults. `system` is absent on purpose —
 * system actions are unlimited unless their contract declares an override.
 * Values change only through spec rework, never ad hoc.
 */
export const rateLimitDefaults: Readonly<
  Record<Exclude<ActionPrincipal, "system">, ActionRateLimit>
> = Object.freeze({
  staff: { limit: 120, windowSec: 60, scope: "user" },
  customer: { limit: 120, windowSec: 60, scope: "user" },
  public: { limit: 30, windowSec: 60, scope: "ipHmac" },
  consumer: { limit: 60, windowSec: 60, scope: "user" },
  account: { limit: 90, windowSec: 60, scope: "user" },
});

/**
 * How often the IP-HMAC keying rotates. Long enough that buckets almost
 * never reset mid-abuse (the bucket window is a minute), short enough that
 * hashed keys cannot track an address across days.
 */
export const IP_HMAC_ROTATION_MS = 24 * 60 * 60 * 1000;

export interface RateLimitHookDeps {
  readonly store: RateLimitStore;
  /**
   * Secret for the rotating IP HMAC, injected from validated config at
   * boot (`packages/config`; wired in fnd-T26). Never derived from data.
   */
  readonly ipHmacSecret: string;
  readonly logger: Logger;
  /** Injectable clock (epoch milliseconds) for tests; defaults to Date.now. */
  readonly now?: () => number;
}

export function createRateLimitHook(deps: RateLimitHookDeps): RateLimitHook {
  if (deps.ipHmacSecret.length === 0) {
    throw new CoreInvariantError(
      "rate-limit hook constructed with an empty ipHmacSecret — config wiring bug",
    );
  }
  const now = deps.now ?? Date.now;

  return {
    async enforce(env) {
      const policy = env.contract.rateLimit ?? defaultPolicyFor(env);
      if (policy === undefined) {
        return; // System action without an override: unlimited (§10).
      }

      const scopeKey = resolveScopeKey(env, policy.scope, {
        ipHmacSecret: deps.ipHmacSecret,
        now,
      });

      let decision;
      try {
        decision = await deps.store.consume({
          key: `rl:${env.contract.name}:${scopeKey}`,
          limit: policy.limit,
          windowSec: policy.windowSec,
        });
      } catch (storeError) {
        if (failsOpen(env)) {
          // The key stays out of the log line on principle; it carries no
          // raw IP, but the action name and error are all operators need.
          deps.logger.error(
            {
              err: storeError,
              action: env.contract.name,
              request_id: env.request.requestId,
            },
            "rate-limit store unavailable — failing open for this action class",
          );
          return;
        }
        throw new RateLimitError(policy.windowSec, undefined, {
          cause: storeError,
          internalMessage: `rate-limit store unavailable — failing closed for "${env.contract.name}" (${env.contract.principal}/${env.contract.risk})`,
        });
      }

      if (!decision.allowed) {
        throw new RateLimitError(decision.retryAfterSec);
      }
    },
  };
}

function defaultPolicyFor(env: PipelineHookEnv): ActionRateLimit | undefined {
  const principal = env.contract.principal;
  return principal === "system" ? undefined : rateLimitDefaults[principal];
}

/**
 * Store failure policy (core.md §10): fail-open only for ordinary
 * authenticated reads — an authenticated principal, `risk: read` — and for
 * system actions (internal callers; availability over throttling). Public
 * actions and every mutation fail closed: abuse pressure concentrates
 * exactly where Redis is down.
 */
function failsOpen(env: PipelineHookEnv): boolean {
  if (env.principal.mode === "system") {
    return true;
  }
  return env.principal.mode !== "public" && env.contract.risk === "read";
}

function resolveScopeKey(
  env: PipelineHookEnv,
  scope: ActionRateLimit["scope"],
  options: { readonly ipHmacSecret: string; readonly now: () => number },
): string {
  switch (scope) {
    case "user":
      return `user:${requireUserId(env)}`;
    case "ipHmac":
      return `ipHmac:${rotatingIpHmac(requireClientIp(env), options)}`;
    case "company":
      return resolveCompanyKey(env);
    case "global":
      return "global";
  }
}

/**
 * The pipeline authenticates before it rate-limits (§4 step 2 before
 * step 3), so a missing session here — or a user-scoped policy on a mode
 * that has no user — is a composition bug, never a client error.
 */
function requireUserId(env: PipelineHookEnv): string {
  const principal = env.principal;
  if (principal.mode === "public" || principal.mode === "system") {
    throw new CoreInvariantError(
      `action "${env.contract.name}" resolves a user-scoped rate limit but its "${principal.mode}" principal carries no user`,
    );
  }
  if (principal.session === null) {
    throw new CoreInvariantError(
      `action "${env.contract.name}" reached the rate-limit step without a session — pipeline ordering bug`,
    );
  }
  return principal.session.userId;
}

/**
 * A missing IP is a transport composition bug (the API factory owns
 * trusted-proxy normalization — same rule as the context factories), and
 * failing here keeps public traffic from ever running unmetered.
 */
function requireClientIp(env: PipelineHookEnv): string {
  const clientIp = env.request.clientIp;
  if (clientIp === undefined) {
    throw new CoreInvariantError(
      `action "${env.contract.name}" resolves an IP-keyed rate limit but the transport supplied no trusted-proxy normalized clientIp`,
    );
  }
  return clientIp;
}

/**
 * Company-scoped buckets are enforceable this early only where the company
 * identifier is *trusted* at the rate-limit step, which is exactly one
 * place: the tenant scope of a system invocation (set by enqueuing code).
 * A staff `x-company-id` selector is unverified until authorization runs
 * (steps 4/7) — keying a bucket off it would let a caller mint a fresh
 * bucket per rotated selector and run unmetered, or drain a victim
 * company's budget by guessing its UUID. Customer/public company scope is
 * resolved by `resolveTarget` after this step. Declaring `scope: "company"`
 * on any of those modes is therefore a metadata bug; staff company budgets
 * need post-authorization enforcement, which lands when an action first
 * requires it.
 */
function resolveCompanyKey(env: PipelineHookEnv): string {
  const principal = env.principal;
  if (principal.mode === "system" && principal.scope.scope === "tenant") {
    return `company:${principal.scope.companyId}`;
  }
  throw new CoreInvariantError(
    `action "${env.contract.name}" declares a company-scoped rate limit but the "${principal.mode}" principal has no trusted company identifier at the rate-limit step`,
  );
}

/**
 * HMAC-SHA256 over the rotation-window index and the IP, truncated to 128
 * bits — plenty for bucketing, and the digest (not the address) is what a
 * Redis key or debug dump would ever expose.
 */
function rotatingIpHmac(
  clientIp: string,
  options: { readonly ipHmacSecret: string; readonly now: () => number },
): string {
  const rotationWindow = Math.floor(options.now() / IP_HMAC_ROTATION_MS);
  return createHmac("sha256", options.ipHmacSecret)
    .update(`${String(rotationWindow)}:${clientIp}`)
    .digest("hex")
    .slice(0, 32);
}
