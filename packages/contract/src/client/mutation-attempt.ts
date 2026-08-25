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

function bytesToUuidV4(bytes: Uint8Array): string {
  const version = bytes[6] ?? 0;
  const variant = bytes[8] ?? 0;
  bytes[6] = (version & 0x0f) | 0x40;
  bytes[8] = (variant & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Expo mutations mint a key before fetch. Native `crypto.randomUUID` /
 * `getRandomValues` throw TypeError ("Illegal invocation") when extracted
 * and `.call`'d; a throw here looks like a network error and never
 * reaches the API. Call them as methods, and fall through if one throws.
 */
function createAttemptKey(): string {
  try {
    const key = globalThis.crypto.randomUUID();
    if (typeof key === "string") {
      return key;
    }
  } catch {
    // Missing randomUUID, or a native function that rejects extraction.
  }
  try {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return bytesToUuidV4(bytes);
  } catch {
    // Missing getRandomValues.
  }
  throw new TypeError(
    "Web Crypto randomUUID or getRandomValues is required to create mutation attempts",
  );
}

/**
 * Start a logical mutation. Call `options` on every attempt of this
 * submit — there is no automatic HTTP retry layer; callers must reuse
 * the same `attempt.options` so retries do not mint a new key.
 */
export function createMutationAttempt(
  createKey?: () => string,
): MutationAttempt {
  const key = createKey === undefined ? createAttemptKey() : createKey();
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
