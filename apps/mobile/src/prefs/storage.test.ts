import { describe, expect, it } from "vitest";

import { ACCESS_TOKEN_KEY } from "../auth/storage";
import {
  assertDevicePrefKey,
  createMemoryPrefsStore,
  DEVICE_PREF_KEYS,
  DEVICE_PREF_LAST_COMPANY_KEY,
  DEVICE_PREF_THEME_KEY,
  isDevicePrefKey,
} from "./storage";

describe("device prefs KV", () => {
  it("round-trips allowed keys and refuses the bearer token key", () => {
    const store = createMemoryPrefsStore();
    expect(DEVICE_PREF_KEYS).not.toContain(ACCESS_TOKEN_KEY);
    expect(isDevicePrefKey(ACCESS_TOKEN_KEY)).toBe(false);
    expect(isDevicePrefKey(DEVICE_PREF_THEME_KEY)).toBe(true);

    store.set(DEVICE_PREF_THEME_KEY, "dark");
    store.set(DEVICE_PREF_LAST_COMPANY_KEY, "company-a");
    expect(store.get(DEVICE_PREF_THEME_KEY)).toBe("dark");
    expect(store.get(DEVICE_PREF_LAST_COMPANY_KEY)).toBe("company-a");

    expect(() => {
      store.set(ACCESS_TOKEN_KEY as typeof DEVICE_PREF_THEME_KEY, "tok");
    }).toThrow(/access token key/);
    expect(() => {
      assertDevicePrefKey(ACCESS_TOKEN_KEY);
    }).toThrow(/access token key/);
    expect(() => {
      store.set("showzy.prefs.unknown" as typeof DEVICE_PREF_THEME_KEY, "x");
    }).toThrow(/unknown device pref key/);
  });
});
