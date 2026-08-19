import { describe, expect, it } from "vitest";

import {
  createMemoryThemeStore,
  DEFAULT_THEME_MODE,
  isThemeMode,
  nativeAppearanceScheme,
  resolveColorScheme,
  unistylesSettings,
} from "./preference";

describe("theme mode (light / dark / system)", () => {
  it("defaults to light, matching V1 first-run", () => {
    expect(DEFAULT_THEME_MODE).toBe("light");
    expect(createMemoryThemeStore().get()).toBe("light");
  });

  it("switches light, dark, and system on the preference store", () => {
    const store = createMemoryThemeStore();
    store.set("dark");
    expect(store.get()).toBe("dark");
    store.set("system");
    expect(store.get()).toBe("system");
    store.set("light");
    expect(store.get()).toBe("light");
  });

  it("resolves system against the platform scheme and pins explicit modes", () => {
    expect(resolveColorScheme("light", "dark")).toBe("light");
    expect(resolveColorScheme("dark", "light")).toBe("dark");
    expect(resolveColorScheme("system", "light")).toBe("light");
    expect(resolveColorScheme("system", "dark")).toBe("dark");
  });

  it("maps Unistyles settings and native appearance from the mode", () => {
    expect(unistylesSettings("system")).toEqual({ adaptiveThemes: true });
    expect(unistylesSettings("light")).toEqual({ initialTheme: "light" });
    expect(unistylesSettings("dark")).toEqual({ initialTheme: "dark" });
    expect(nativeAppearanceScheme("system")).toBe("unspecified");
    expect(nativeAppearanceScheme("dark")).toBe("dark");
  });

  it("rejects unknown stored values", () => {
    expect(isThemeMode("light")).toBe(true);
    expect(isThemeMode("dim")).toBe(false);
    expect(isThemeMode(null)).toBe(false);
  });
});
