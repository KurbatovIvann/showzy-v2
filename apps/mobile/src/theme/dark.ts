import {
  darkGlassFallback,
  darkGlassFallbackDense,
  darkGlassFallbackPressed,
  darkPalette,
  hitTarget,
  iconSize,
  radii,
  shadows,
  spacing,
  squircle,
  typography,
} from "./tokens";

export const darkTheme = {
  colors: darkPalette,
  spacing,
  radii,
  typography,
  shadows,
  hitTarget,
  iconSize,
  squircle,
  glassFallback: darkGlassFallback,
  glassFallbackDense: darkGlassFallbackDense,
  glassFallbackPressed: darkGlassFallbackPressed,
} as const;
