/**
 * In-memory stand-in for Redis secondary storage (tests and the T6 auth
 * suite). Production mounts {@link createRedisSecondaryStorage}.
 *
 * `getAndDelete` is atomic here because JavaScript is single-threaded; the
 * Redis client uses `GETDEL` for the same contract across processes.
 */
export interface SecondaryStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  getAndDelete(key: string): Promise<string | null>;
}

interface Entry {
  value: string;
  expiresAtMs: number | undefined;
}

export function createMemorySecondaryStorage(options?: {
  readonly now?: () => number;
}): SecondaryStorage {
  const now = options?.now ?? Date.now;
  const entries = new Map<string, Entry>();

  function read(key: string): string | null {
    const entry = entries.get(key);
    if (entry === undefined) {
      return null;
    }
    if (entry.expiresAtMs !== undefined && entry.expiresAtMs <= now()) {
      entries.delete(key);
      return null;
    }
    return entry.value;
  }

  return {
    get(key) {
      return Promise.resolve(read(key));
    },
    set(key, value, ttlSeconds) {
      const expiresAtMs =
        ttlSeconds !== undefined && ttlSeconds > 0
          ? now() + ttlSeconds * 1000
          : undefined;
      entries.set(key, { value, expiresAtMs });
      return Promise.resolve();
    },
    delete(key) {
      entries.delete(key);
      return Promise.resolve();
    },
    getAndDelete(key) {
      const value = read(key);
      entries.delete(key);
      return Promise.resolve(value);
    },
  };
}
