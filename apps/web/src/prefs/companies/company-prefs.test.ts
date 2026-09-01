import { describe, expect, it } from "vitest";

import { createCompanyPrefs } from "./company-prefs";
import {
  createMemoryPrefsStore,
  DEVICE_PREF_LAST_COMPANY_SLUG_KEY,
} from "../storage";

describe("company prefs (last slug)", () => {
  it("persists a slug and treats blank as cleared", () => {
    const kv = createMemoryPrefsStore();
    const prefs = createCompanyPrefs(kv);
    expect(prefs.getLastCompanySlug()).toBeNull();

    prefs.setLastCompanySlug("kviti-lviv");
    expect(prefs.getLastCompanySlug()).toBe("kviti-lviv");
    expect(kv.get(DEVICE_PREF_LAST_COMPANY_SLUG_KEY)).toBe("kviti-lviv");

    prefs.setLastCompanySlug("  ");
    expect(prefs.getLastCompanySlug()).toBeNull();
    expect(kv.get(DEVICE_PREF_LAST_COMPANY_SLUG_KEY)).toBeNull();
  });

  it("ignores a stored empty string", () => {
    const prefs = createCompanyPrefs(
      createMemoryPrefsStore({ [DEVICE_PREF_LAST_COMPANY_SLUG_KEY]: "" }),
    );
    expect(prefs.getLastCompanySlug()).toBeNull();
  });
});
