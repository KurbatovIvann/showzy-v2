/**
 * In-memory cookie jar used by tests and as the native hydrate buffer.
 * Native persistence lives in `platform-storage.ts` so this file stays
 * runnable in Docker-free vitest.
 */
export type ExpoAuthStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void | Promise<void>;
};

export const AUTH_STORAGE_PREFIX = "showzy";

export function createMemoryAuthStorage(
  initial: Readonly<Record<string, string>> = {},
): ExpoAuthStorage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      if (value === "") {
        map.delete(key);
        return;
      }
      map.set(key, value);
    },
  };
}
