/**
 * Unistyles bootstrap. Import this module from the Expo entry and the
 * root layout *before* any component that calls `StyleSheet.create`.
 * Tests must not import this file — it loads the native Unistyles runtime.
 */
import { StyleSheet } from "react-native-unistyles";

import { darkTheme } from "./dark";
import { lightTheme } from "./light";
import { createMemoryThemeStore, unistylesSettings } from "./preference";

type AppThemes = {
  light: typeof lightTheme;
  dark: typeof darkTheme;
};

declare module "react-native-unistyles" {
  export interface UnistylesThemes {
    light: AppThemes["light"];
    dark: AppThemes["dark"];
  }
}

export const themePreference = createMemoryThemeStore();

StyleSheet.configure({
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  settings: unistylesSettings(themePreference.get()),
});
