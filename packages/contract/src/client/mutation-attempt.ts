/**
 * One idempotency key per logical submit (contract.md §3, core.md §5).
 *
 * The server never generates a key — it cannot infer a button press. The
 * client creates one UUID and reuses it for every retry of that submit,
 * including the confirmation re-invocation (the challenge travels as
 * separate transport meta so the input hash stays stable).
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
 * submit — automatic retries must not mint a new key.
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
