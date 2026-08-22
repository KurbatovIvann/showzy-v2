import {
  hitTarget,
  iconSize,
  lightGlassFallback,
  lightGlassFallbackDense,
  lightGlassFallbackPressed,
  lightPalette,
  radii,
  shadows,
  spacing,
  squircle,
  typography,
} from "./tokens";

export const lightTheme = {
  colors: lightPalette,
  spacing,
  radii,
  typography,
  shadows,
  hitTarget,
  iconSize,
  squircle,
  glassFallback: lightGlassFallback,
  glassFallbackDense: lightGlassFallbackDense,
  glassFallbackPressed: lightGlassFallbackPressed,
} as const;
