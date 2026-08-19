/**
 * V1 mobile tokens, transcribed for V2 (ADR-0019).
 *
 * Source: `E:\showzy\apps\mobile\src\theme\tokens.ts` plus the inventory
 * in `docs/design/inventory/v1-mobile-token-baseline.md`. V1 is the
 * authority when the inventory snapshot disagrees (glass alpha, hex
 * casing). A color rebrand is a separate owner-approved change.
 *
 * Components consume semantic roles from a Unistyles theme, never these
 * palette values directly, except audited artwork.
 */

export const lightPalette = {
  background: "#F0EDE7",
  foreground: "#1A1814",
  card: "#FDFCFA",
  cardForeground: "#1A1814",
  popover: "#FDFCFA",
  popoverForeground: "#1A1814",
  primary: "#1C1A15",
  primaryForeground: "#F0EDE7",
  secondary: "#E8E5DF",
  secondaryForeground: "#1A1814",
  muted: "#E5E2DC",
  mutedForeground: "#7A7570",
  accent: "#2684CC",
  accentForeground: "#FDFCFA",
  destructive: "#ef4343",
  destructiveForeground: "#FDFCFA",
  success: "#21c45d",
  successForeground: "#ffffff",
  warning: "#f59f0a",
  warningForeground: "#000000",
  border: "#D8D4CC",
  input: "#D8D4CC",
  inputFill: "#F2F0EB",
  ring: "#2684CC",

  white: "#FEFDFB",
  black: "#1A1814",
  skeleton: "#E5E2DC",

  status: {
    pending: "#E09F3E",
    pendingForeground: "#000000",
    progress: "#5B8CB8",
    progressForeground: "#ffffff",
    ready: "#3DAD9C",
    readyForeground: "#ffffff",
    success: "#3DAD6B",
    successForeground: "#ffffff",
    neutral: "#8A857E",
    neutralForeground: "#ffffff",
    danger: "#D45B5B",
    dangerForeground: "#ffffff",
  },

  documentStatus: {
    sentBg: "#dbeafe",
    sentText: "#1e40af",
    signedBg: "#dcfce7",
    signedText: "#166534",
    cancelledBg: "#fee2e2",
    cancelledText: "#991b1b",
    awaitingBg: "#fef3c7",
    awaitingText: "#92400e",
  },

  overlay: "rgba(0, 0, 0, 0.06)",

  icon: {
    default: "#7A7570",
    muted: "#A09A92",
    active: "#1C1A15",
    inactive: "#8e8e93",
  },

  activityIndicator: {
    onPrimary: "#F0EDE7",
    onBackground: "#1C1A15",
  },
} as const;

export const darkPalette = {
  background: "#161410",
  foreground: "#E6E3DD",
  card: "#211F1A",
  cardForeground: "#E6E3DD",
  popover: "#211F1A",
  popoverForeground: "#E6E3DD",
  primary: "#E6E3DD",
  primaryForeground: "#161410",
  secondary: "#2A2722",
  secondaryForeground: "#E6E3DD",
  muted: "#211F1A",
  mutedForeground: "#908B84",
  accent: "#5CB0E0",
  accentForeground: "#161410",
  destructive: "#d15147",
  destructiveForeground: "#ffffff",
  success: "#4ca957",
  successForeground: "#ffffff",
  warning: "#cd922d",
  warningForeground: "#ffffff",
  border: "#322F2A",
  input: "#322F2A",
  inputFill: "#2A2722",
  ring: "#5CB0E0",

  white: "#FEFDFB",
  black: "#161410",
  skeleton: "#322F2A",

  status: {
    pending: "#E0B652",
    pendingForeground: "#000000",
    progress: "#7A9EC0",
    progressForeground: "#000000",
    ready: "#5EC9BB",
    readyForeground: "#000000",
    success: "#5EC994",
    successForeground: "#000000",
    neutral: "#908B84",
    neutralForeground: "#000000",
    danger: "#DB7770",
    dangerForeground: "#000000",
  },

  documentStatus: {
    sentBg: "rgba(30, 64, 175, 0.2)",
    sentText: "#60a5fa",
    signedBg: "rgba(22, 101, 52, 0.2)",
    signedText: "#4ade80",
    cancelledBg: "rgba(153, 27, 27, 0.2)",
    cancelledText: "#f87171",
    awaitingBg: "rgba(146, 64, 14, 0.2)",
    awaitingText: "#fbbf24",
  },

  overlay: "rgba(255, 255, 255, 0.12)",

  icon: {
    default: "#908B84",
    muted: "#6B6660",
    active: "#E6E3DD",
    inactive: "#8e8e93",
  },

  activityIndicator: {
    onPrimary: "#161410",
    onBackground: "#E6E3DD",
  },
} as const;

export type ColorPalette = typeof lightPalette;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 25,
  full: 9999,
} as const;

export type TypeScale = {
  readonly fontSize: number;
  readonly lineHeight: number;
};

export const typography = {
  xs: { fontSize: 13, lineHeight: 18 },
  sm: { fontSize: 14, lineHeight: 20 },
  base: { fontSize: 15, lineHeight: 22 },
  md: { fontSize: 16, lineHeight: 22 },
  lg: { fontSize: 18, lineHeight: 24 },
  xl: { fontSize: 20, lineHeight: 26 },
  "2xl": { fontSize: 24, lineHeight: 30 },
  "3xl": { fontSize: 28, lineHeight: 34 },
  "4xl": { fontSize: 32, lineHeight: 38 },
} as const satisfies Record<string, TypeScale>;

export type TypographyKey = keyof typeof typography;

export const avatarSizes = {
  sm: 32,
  md: 42,
  lg: 80,
  xl: 96,
} as const;

export const companyAvatarSizes = {
  xs: { dimension: 32, radius: 8, text: "xs" },
  sm: { dimension: 36, radius: 10, text: "base" },
  md: { dimension: 44, radius: 12, text: "lg" },
  lg: { dimension: 64, radius: 16, text: "2xl" },
  xl: { dimension: 120, radius: 20, text: "3xl" },
} as const satisfies Record<
  string,
  {
    readonly dimension: number;
    readonly radius: number;
    readonly text: TypographyKey;
  }
>;

export const shadows = {
  sm: {
    shadowColor: "#2A2518",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: "#2A2518",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: "#2A2518",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  xl: {
    shadowColor: "#2A2518",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 12,
  },
} as const;

export type GlassFallback = {
  readonly backgroundColor: string;
  readonly borderWidth: number;
  readonly borderColor?: string;
};

export const lightGlassFallback: GlassFallback = {
  backgroundColor: "rgba(253, 252, 250, 0.92)",
  borderWidth: 0.5,
  borderColor: "rgba(100, 116, 139, 0.15)",
};

export const lightGlassFallbackDense: GlassFallback = {
  backgroundColor: "rgba(253, 252, 250, 0.97)",
  borderWidth: 0,
};

export const lightGlassFallbackPressed: GlassFallback = {
  backgroundColor: "hsl(218, 16%, 93%)",
  borderWidth: 0.5,
  borderColor: "hsl(218, 16%, 93%)",
};

export const darkGlassFallback: GlassFallback = {
  backgroundColor: "rgba(33, 31, 26, 0.92)",
  borderWidth: 0.5,
  borderColor: "rgba(255, 255, 255, 0.12)",
};

export const darkGlassFallbackDense: GlassFallback = {
  backgroundColor: "rgba(33, 31, 26, 0.97)",
  borderWidth: 0,
};

export const darkGlassFallbackPressed: GlassFallback = {
  backgroundColor: "rgba(50, 47, 42, 0.97)",
  borderWidth: 0.5,
  borderColor: "rgba(255, 255, 255, 0.12)",
};
