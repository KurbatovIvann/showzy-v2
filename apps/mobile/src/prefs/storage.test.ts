import { describe, expect, it } from "vitest";

import { AUTH_COOKIE_KEY } from "../auth/storage";
import {
  assertDevicePrefKey,
  createMemoryPrefsStore,
  DEVICE_PREF_KEYS,
  DEVICE_PREF_LAST_COMPANY_KEY,
  DEVICE_PREF_THEME_KEY,
  isDevicePrefKey,
} from "./storage";

describe("device prefs KV", () => {
  it("round-trips allowed keys and refuses the auth cookie key", () => {
    const store = createMemoryPrefsStore();
    expect(DEVICE_PREF_KEYS).not.toContain(AUTH_COOKIE_KEY);
    expect(isDevicePrefKey(AUTH_COOKIE_KEY)).toBe(false);
    expect(isDevicePrefKey(DEVICE_PREF_THEME_KEY)).toBe(true);

    store.set(DEVICE_PREF_THEME_KEY, "dark");
    store.set(DEVICE_PREF_LAST_COMPANY_KEY, "company-a");
    expect(store.get(DEVICE_PREF_THEME_KEY)).toBe("dark");
    expect(store.get(DEVICE_PREF_LAST_COMPANY_KEY)).toBe("company-a");

    expect(() => {
      store.set(AUTH_COOKIE_KEY as typeof DEVICE_PREF_THEME_KEY, "tok");
    }).toThrow(/auth cookie key/);
    expect(() => {
      assertDevicePrefKey(AUTH_COOKIE_KEY);
    }).toThrow(/auth cookie key/);
    expect(() => {
      store.set("showzy.prefs.unknown" as typeof DEVICE_PREF_THEME_KEY, "x");
    }).toThrow(/unknown device pref key/);
  });
});
