/**
 * Device-preference KV for the staff panel (SHO-313).
 * Allowed key is the last visited company slug — a display selector,
 * never an access grant (ADR-0013). Session cookies stay HttpOnly.
 */
export const DEVICE_PREF_LAST_COMPANY_SLUG_KEY =
  "showzy.prefs.last-company-slug";

export const DEVICE_PREF_KEYS = [DEVICE_PREF_LAST_COMPANY_SLUG_KEY] as const;

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
  if (!isDevicePrefKey(key)) {
    throw new Error("unknown device pref key");
  }
}

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
