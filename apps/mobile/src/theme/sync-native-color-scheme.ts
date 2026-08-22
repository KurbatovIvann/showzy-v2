import { Appearance } from "react-native";

import { nativeAppearanceScheme, type ThemeMode } from "./preference";

/** Pins iOS/Android chrome (IME, status bar, window) to the app theme.
 * Unistyles can stay light while `userInterfaceStyle: automatic` would
 * otherwise follow a dark OS and paint a black keyboard on a light screen. */
export function syncNativeColorScheme(mode: ThemeMode): void {
  Appearance.setColorScheme(nativeAppearanceScheme(mode));
}
