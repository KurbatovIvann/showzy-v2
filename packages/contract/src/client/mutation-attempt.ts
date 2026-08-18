/**
 * One idempotency key per logical submit (contract.md §3, core.md §5).
 *
 * The server never generates a key — it cannot infer a button press. The
 * client mints one UUID via `createMutationAttempt()`; callers pass
 * `attempt.options` on every retry of that submit. There is no automatic
 * HTTP retry layer. The confirmation re-invocation uses
 * `attempt.withChallenge(id)` so the challenge stays out of action input.
 */

/** Second argument to an oRPC procedure call — transport meta only. */
export interface MutationCallOptions {
  readonly context: {
    readonly idempotencyKey: string;
    readonly confirmationChallengeId?: string;
  };
}

export interface MutationAttempt {
  /** Stable UUID for this logical submit; never regenerated on retry. */
  readonly key: string;
  /** Pass as the second argument of the RPC call. */
  readonly options: MutationCallOptions;
  /**
   * Same key plus the confirmation challenge from a
   * `CONFIRMATION_REQUIRED` wire error. The challenge is meta, not input.
   */
  withChallenge(challengeId: string): MutationCallOptions;
}

function createAttemptKey(): string {
  if (typeof globalThis.crypto.randomUUID !== "function") {
    throw new TypeError(
      "Web Crypto randomUUID is required to create mutation attempts",
    );
  }
  return globalThis.crypto.randomUUID();
}

/**
 * Start a logical mutation. Call `options` on every attempt of this
 * submit — there is no automatic HTTP retry layer; callers must reuse
 * the same `attempt.options` so retries do not mint a new key.
 */
export function createMutationAttempt(): MutationAttempt {
  const key = createAttemptKey();
  const options: MutationCallOptions = { context: { idempotencyKey: key } };
  return {
    key,
    options,
    withChallenge(challengeId: string): MutationCallOptions {
      return {
        context: {
          idempotencyKey: key,
          confirmationChallengeId: challengeId,
        },
      };
    },
  };
}
