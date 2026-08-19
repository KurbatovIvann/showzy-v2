import {
  darkGlassFallback,
  darkGlassFallbackDense,
  darkGlassFallbackPressed,
  darkPalette,
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
  glassFallback: darkGlassFallback,
  glassFallbackDense: darkGlassFallbackDense,
  glassFallbackPressed: darkGlassFallbackPressed,
} as const;
