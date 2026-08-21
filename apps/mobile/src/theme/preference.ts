/**
 * Theme mode is a user preference: light, dark, or follow the platform
 * (`system`). Default is `light`, matching V1 (a `system` default followed
 * a dark iPhone and surprised first-run users).
 */

export type ThemeMode = "system" | "light" | "dark";
export type ColorScheme = "light" | "dark";

export const DEFAULT_THEME_MODE: ThemeMode = "light";

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

/** Corrupt or unknown stored values fall back to the first-run default. */
export function themeModeFromStoredValue(value: unknown): ThemeMode {
  return isThemeMode(value) ? value : DEFAULT_THEME_MODE;
}

export function resolveColorScheme(
  mode: ThemeMode,
  systemScheme: ColorScheme,
): ColorScheme {
  return mode === "system" ? systemScheme : mode;
}

export function nativeAppearanceScheme(
  mode: ThemeMode,
): ColorScheme | "unspecified" {
  return mode === "system" ? "unspecified" : mode;
}

export type UnistylesSettings =
  | { readonly adaptiveThemes: true }
  | { readonly initialTheme: "light" | "dark" };

export function unistylesSettings(mode: ThemeMode): UnistylesSettings {
  if (mode === "system") {
    return { adaptiveThemes: true };
  }
  return { initialTheme: mode };
}

export interface ThemePreferenceStore {
  get(): ThemeMode;
  set(mode: ThemeMode): void;
}

export function createMemoryThemeStore(
  initial: ThemeMode = DEFAULT_THEME_MODE,
): ThemePreferenceStore {
  let mode = initial;
  return {
    get(): ThemeMode {
      return mode;
    },
    set(next: ThemeMode): void {
      mode = next;
    },
  };
}
