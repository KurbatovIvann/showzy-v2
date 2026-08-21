/**
 * Device-preference KV. Allowed keys are theme and last company selector.
 * Bearer tokens stay in SecureStore (`ACCESS_TOKEN_KEY`); this store
 * refuses that key at the API boundary.
 */
import { ACCESS_TOKEN_KEY } from "../auth/storage";

export const DEVICE_PREF_THEME_KEY = "showzy.prefs.theme";
export const DEVICE_PREF_LAST_COMPANY_KEY = "showzy.prefs.last-company";

export const DEVICE_PREF_KEYS = [
  DEVICE_PREF_THEME_KEY,
  DEVICE_PREF_LAST_COMPANY_KEY,
] as const;

export type DevicePrefKey = (typeof DEVICE_PREF_KEYS)[number];

export interface PrefsKvStore {
  get(key: DevicePrefKey): string | null;
  set(key: DevicePrefKey, value: string): void;
  remove(key: DevicePrefKey): void;
}

export function isDevicePrefKey(key: string): key is DevicePrefKey {
  return (DEVICE_PREF_KEYS as readonly string[]).includes(key);
}

export function assertDevicePrefKey(key: string): asserts key is DevicePrefKey {
  if (key === ACCESS_TOKEN_KEY) {
    throw new Error("device prefs must not store the access token key");
  }
  if (!isDevicePrefKey(key)) {
    throw new Error("unknown device pref key");
  }
}

/**
 * In-memory adapter for tests and web. `initial` may contain a corrupt
 * theme value so restore tests can prove the fallback; writes still go
 * through {@link assertDevicePrefKey}.
 */
export function createMemoryPrefsStore(
  initial: Readonly<Record<string, string>> = {},
): PrefsKvStore {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    get(key) {
      assertDevicePrefKey(key);
      return data.get(key) ?? null;
    },
    set(key, value) {
      assertDevicePrefKey(key);
      data.set(key, value);
    },
    remove(key) {
      assertDevicePrefKey(key);
      data.delete(key);
    },
  };
}
