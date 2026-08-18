/**
 * The confirmation-challenge storage seam (core.md §7).
 *
 * Core stays dependency-free: the production store is Redis, mounted by
 * the apps in fnd-T26. Challenges are single-use, so the store must
 * implement atomic consume (`GETDEL`). Tests and local development use
 * `createInMemoryConfirmationStore`, which encodes the same semantics.
 *
 * A store that cannot decide (connection loss, timeout) must throw — the
 * hook owns fail-closed; the store never guesses.
 */
export interface ConfirmationStore {
  set(key: string, value: string, ttlMs: number): Promise<void>;
  /** Atomic read-and-delete. `null` if missing or expired. */
  getAndDelete(key: string): Promise<string | null>;
}

interface Entry {
  value: string;
  expiresAtMs: number;
}

/**
 * In-memory challenge store: single-process only (tests, local dev).
 * Expiry is checked at consume time. Production Redis replaces this with
 * per-key TTLs and `GETDEL`.
 */
export function createInMemoryConfirmationStore(options?: {
  /** Injectable clock (epoch milliseconds) for tests; defaults to Date.now. */
  readonly now?: () => number;
}): ConfirmationStore {
  const now = options?.now ?? Date.now;
  const entries = new Map<string, Entry>();

  return {
    set(key, value, ttlMs) {
      entries.set(key, { value, expiresAtMs: now() + ttlMs });
      return Promise.resolve();
    },
    getAndDelete(key) {
      const entry = entries.get(key);
      entries.delete(key);
      if (entry === undefined || entry.expiresAtMs <= now()) {
        return Promise.resolve(null);
      }
      return Promise.resolve(entry.value);
    },
  };
}
