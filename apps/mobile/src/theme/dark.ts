import {
  darkGlassFallback,
  darkGlassFallbackDense,
  darkGlassFallbackPressed,
  darkPalette,
  hitTarget,
  radii,
  shadows,
  spacing,
  typography,
} from "./tokens";

export const darkTheme = {
  colors: darkPalette,
  spacing,
  radii,
  typography,
  shadows,
  hitTarget,
  glassFallback: darkGlassFallback,
  glassFallbackDense: darkGlassFallbackDense,
  glassFallbackPressed: darkGlassFallbackPressed,
} as const;
