import { describe, expect, it } from "vitest";

import { createShowzyClient } from "../api/client";
import { ACCESS_TOKEN_KEY } from "../auth/storage";
import { DEFAULT_THEME_MODE } from "../theme/preference";
import {
  applySessionHydrateToCompanySelector,
  asThemePreferenceStore,
  bindCompanySelectorPersistence,
  createDevicePrefs,
  restoreLastCompanySelector,
} from "./device-prefs";
import {
  createMemoryPrefsStore,
  DEVICE_PREF_KEYS,
  DEVICE_PREF_LAST_COMPANY_KEY,
  DEVICE_PREF_THEME_KEY,
} from "./storage";

describe("device prefs (memory adapter)", () => {
  it("persists and restores theme; invalid stored values fall back to light", () => {
    const kv = createMemoryPrefsStore();
    const prefs = createDevicePrefs(kv);
    expect(prefs.getTheme()).toBe(DEFAULT_THEME_MODE);

    prefs.setTheme("dark");
    expect(createDevicePrefs(kv).getTheme()).toBe("dark");

    prefs.setTheme("system");
    expect(createDevicePrefs(kv).getTheme()).toBe("system");

    const corrupt = createDevicePrefs(
      createMemoryPrefsStore({ [DEVICE_PREF_THEME_KEY]: "dim" }),
    );
    expect(corrupt.getTheme()).toBe("light");

    const themeStore = asThemePreferenceStore(prefs);
    themeStore.set("light");
    expect(themeStore.get()).toBe("light");
  });

  it("persists and restores the last company selector through the client", () => {
    const kv = createMemoryPrefsStore();
    const prefs = createDevicePrefs(kv);
    const created = createShowzyClient({ apiUrl: "http://api.test" });
    bindCompanySelectorPersistence(created, prefs);

    expect(prefs.getLastCompanyId()).toBeNull();
    created.setActiveCompany("company-a");
    expect(prefs.getLastCompanyId()).toBe("company-a");
    expect(created.getActiveCompany()).toBe("company-a");

    const restored = createShowzyClient({ apiUrl: "http://api.test" });
    restoreLastCompanySelector(restored, createDevicePrefs(kv));
    expect(restored.getActiveCompany()).toBe("company-a");
  });

  it("restores the selector only on a live hydrate and clears it when unsigned", () => {
    const kv = createMemoryPrefsStore({
      [DEVICE_PREF_LAST_COMPANY_KEY]: "company-a",
    });
    const prefs = createDevicePrefs(kv);
    const created = createShowzyClient({ apiUrl: "http://api.test" });
    bindCompanySelectorPersistence(created, prefs);

    applySessionHydrateToCompanySelector(created, prefs, null);
    expect(created.getActiveCompany()).toBeNull();
    expect(prefs.getLastCompanyId()).toBeNull();

    prefs.setLastCompanyId("company-a");
    applySessionHydrateToCompanySelector(created, prefs, { userId: "u-1" });
    expect(created.getActiveCompany()).toBe("company-a");

    created.setActiveCompany("company-b");
    applySessionHydrateToCompanySelector(created, prefs, { userId: "u-1" });
    expect(created.getActiveCompany()).toBe("company-b");
  });

  it("clears the selector on sign-out and keeps theme", () => {
    const kv = createMemoryPrefsStore();
    const prefs = createDevicePrefs(kv);
    prefs.setTheme("dark");
    const created = createShowzyClient({
      apiUrl: "http://api.test",
      initialCompanyId: "company-a",
    });
    bindCompanySelectorPersistence(created, prefs);
    created.setActiveCompany("company-a");

    created.setActiveCompany(null);

    expect(created.getActiveCompany()).toBeNull();
    expect(prefs.getLastCompanyId()).toBeNull();
    expect(prefs.getTheme()).toBe("dark");
    expect(createDevicePrefs(kv).getTheme()).toBe("dark");
  });

  it("never writes the access token key through the prefs API", () => {
    expect(DEVICE_PREF_KEYS).not.toContain(ACCESS_TOKEN_KEY);
    const kv = createMemoryPrefsStore();
    const prefs = createDevicePrefs(kv);
    prefs.setTheme("dark");
    prefs.setLastCompanyId("company-a");
    expect(kv.get(DEVICE_PREF_THEME_KEY)).toBe("dark");
    expect(() => {
      kv.set(ACCESS_TOKEN_KEY as typeof DEVICE_PREF_THEME_KEY, "Bearer secret");
    }).toThrow(/access token key/);
  });
});
