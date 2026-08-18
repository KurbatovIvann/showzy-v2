/**
 * The rate-limit storage seam (core.md §10) plus the reference token-bucket
 * implementation.
 *
 * Core stays dependency-free: the production store is Redis (mounted by
 * `apps/api`/`apps/worker` in fnd-T26 — the bucket math must run atomically
 * there, e.g. as a Lua script), while tests and local development use
 * `createInMemoryRateLimitStore`, which encodes the same semantics and is
 * the behavioral contract a Redis implementation must match.
 */

/** One token-bucket consume attempt for a fully resolved bucket key. */
export interface RateLimitConsumeRequest {
  /**
   * The complete bucket key (`rl:<action>:<scope>:<value>`). Built by the
   * hook; never contains a raw IP — public traffic is keyed by a rotating
   * HMAC (core.md §10).
   */
  readonly key: string;
  /** Bucket capacity: at most `limit` requests per `windowSec` burst. */
  readonly limit: number;
  /** Refill window: the bucket regains `limit` tokens per `windowSec`. */
  readonly windowSec: number;
}

export type RateLimitDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly retryAfterSec: number };

/**
 * Takes one token from the bucket, atomically. A store that cannot decide
 * (connection loss, timeout) must throw — the hook owns the fail-open /
 * fail-closed split per action class; the store never guesses.
 */
export interface RateLimitStore {
  consume(request: RateLimitConsumeRequest): Promise<RateLimitDecision>;
}

interface BucketState {
  tokens: number;
  updatedAtMs: number;
}

/**
 * In-memory token bucket: continuous refill at `limit / windowSec` tokens
 * per second, capped at `limit`. Single-process only (tests, local dev) —
 * state is a plain map and is never shared or pruned; the Redis store with
 * per-key TTLs replaces it wherever more than one process serves traffic.
 */
export function createInMemoryRateLimitStore(options?: {
  /** Injectable clock (epoch milliseconds) for tests; defaults to Date.now. */
  readonly now?: () => number;
}): RateLimitStore {
  const now = options?.now ?? Date.now;
  const buckets = new Map<string, BucketState>();

  return {
    consume(request) {
      const nowMs = now();
      const state = buckets.get(request.key) ?? {
        tokens: request.limit,
        updatedAtMs: nowMs,
      };

      const elapsedMs = Math.max(0, nowMs - state.updatedAtMs);
      const refill = (elapsedMs / 1000) * (request.limit / request.windowSec);
      const tokens = Math.min(request.limit, state.tokens + refill);

      if (tokens < 1) {
        buckets.set(request.key, { tokens, updatedAtMs: nowMs });
        // Time until one whole token has refilled, rounded up to whole
        // seconds so the client hint is never optimistic.
        const secondsPerToken = request.windowSec / request.limit;
        const retryAfterSec = Math.max(
          1,
          Math.ceil((1 - tokens) * secondsPerToken),
        );
        return Promise.resolve({ allowed: false, retryAfterSec });
      }

      buckets.set(request.key, { tokens: tokens - 1, updatedAtMs: nowMs });
      return Promise.resolve({ allowed: true });
    },
  };
}
