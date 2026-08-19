import {
  lightGlassFallback,
  lightGlassFallbackDense,
  lightGlassFallbackPressed,
  lightPalette,
  radii,
  shadows,
  spacing,
  typography,
} from "./tokens";

export const lightTheme = {
  colors: lightPalette,
  spacing,
  radii,
  typography,
  shadows,
  glassFallback: lightGlassFallback,
  glassFallbackDense: lightGlassFallbackDense,
  glassFallbackPressed: lightGlassFallbackPressed,
} as const;
