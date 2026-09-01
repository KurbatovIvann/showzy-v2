import { describe, expect, it } from "vitest";

import { createLocalStoragePrefsStore } from "./local-storage";
import {
  assertDevicePrefKey,
  createMemoryPrefsStore,
  DEVICE_PREF_KEYS,
  DEVICE_PREF_LAST_COMPANY_SLUG_KEY,
  isDevicePrefKey,
} from "./storage";

describe("device prefs KV", () => {
  it("round-trips the last-company slug and refuses unknown keys", () => {
    const store = createMemoryPrefsStore();
    expect(DEVICE_PREF_KEYS).toEqual([DEVICE_PREF_LAST_COMPANY_SLUG_KEY]);
    expect(isDevicePrefKey(DEVICE_PREF_LAST_COMPANY_SLUG_KEY)).toBe(true);
    expect(isDevicePrefKey("showzy.prefs.theme")).toBe(false);

    store.set(DEVICE_PREF_LAST_COMPANY_SLUG_KEY, "kviti-lviv");
    expect(store.get(DEVICE_PREF_LAST_COMPANY_SLUG_KEY)).toBe("kviti-lviv");
    store.remove(DEVICE_PREF_LAST_COMPANY_SLUG_KEY);
    expect(store.get(DEVICE_PREF_LAST_COMPANY_SLUG_KEY)).toBeNull();

    expect(() => {
      store.set(
        "showzy.prefs.unknown" as typeof DEVICE_PREF_LAST_COMPANY_SLUG_KEY,
        "x",
      );
    }).toThrow(/unknown device pref key/);
    expect(() => {
      assertDevicePrefKey("better-auth.session_token");
    }).toThrow(/unknown device pref key/);
  });

  it("reads and writes the slug through localStorage", () => {
    window.localStorage.clear();
    const store = createLocalStoragePrefsStore();
    store.set(DEVICE_PREF_LAST_COMPANY_SLUG_KEY, "pekarnya");
    expect(window.localStorage.getItem(DEVICE_PREF_LAST_COMPANY_SLUG_KEY)).toBe(
      "pekarnya",
    );
    expect(
      createLocalStoragePrefsStore().get(DEVICE_PREF_LAST_COMPANY_SLUG_KEY),
    ).toBe("pekarnya");
  });
});
