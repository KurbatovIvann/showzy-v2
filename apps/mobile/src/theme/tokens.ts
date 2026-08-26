/**
 * Canvas tokens mapped into Unistyles (ADR-0024).
 *
 * Light hex values come from the Magic Patterns canvas
 * `tailwind.config.js`. Dark is the same roles, not a second palette
 * invented per screen. Components consume semantic roles from the theme,
 * never these values directly, except audited artwork.
 *
 * Source of the map: `docs/design/mapping/mp-to-mobile.md`.
 */

export const lightPalette = {
  background: "#F7F6F2",
  foreground: "#1C1C1A",
  card: "#FFFFFF",
  cardForeground: "#1C1C1A",
  popover: "#FFFFFF",
  popoverForeground: "#1C1C1A",
  primary: "#1C1C1A",
  primaryForeground: "#FFFFFF",
  secondary: "#E5E2DA",
  secondaryForeground: "#1C1C1A",
  muted: "#E5E2DA",
  mutedForeground: "#6E6A61",
  accent: "#2F6FED",
  accentForeground: "#FFFFFF",
  accentSoft: "#E8F0FF",
  destructive: "#C0392B",
  destructiveForeground: "#FFFFFF",
  destructiveSoft: "#FBEAE7",
  success: "#237A4B",
  successForeground: "#FFFFFF",
  successSoft: "#E6F2EA",
  warning: "#A65A16",
  warningForeground: "#FFFFFF",
  warningSoft: "#FBEFE1",
  border: "#E5E2DA",
  input: "#E5E2DA",
  inputFill: "#F7F6F2",
  ring: "#2F6FED",

  white: "#FFFFFF",
  black: "#1C1C1A",
  skeleton: "#E5E2DA",

  status: {
    pending: "#FBEFE1",
    pendingForeground: "#A65A16",
    progress: "#E8F0FF",
    progressForeground: "#2F6FED",
    ready: "#E6F2EA",
    readyForeground: "#237A4B",
    success: "#E6F2EA",
    successForeground: "#237A4B",
    neutral: "#F7F6F2",
    neutralForeground: "#6E6A61",
    danger: "#FBEAE7",
    dangerForeground: "#C0392B",
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

  overlay: "rgba(28, 28, 26, 0.35)",

  icon: {
    default: "#6E6A61",
    muted: "#9B968B",
    active: "#1C1C1A",
    inactive: "#9B968B",
  },

  activityIndicator: {
    onPrimary: "#FFFFFF",
    onBackground: "#1C1C1A",
  },
} as const;

export const darkPalette = {
  background: "#161410",
  foreground: "#EDEBE6",
  card: "#211F1A",
  cardForeground: "#EDEBE6",
  popover: "#211F1A",
  popoverForeground: "#EDEBE6",
  primary: "#EDEBE6",
  primaryForeground: "#161410",
  secondary: "#322F2A",
  secondaryForeground: "#EDEBE6",
  muted: "#322F2A",
  mutedForeground: "#9B968B",
  accent: "#5B8FFF",
  accentForeground: "#161410",
  accentSoft: "#1A2744",
  destructive: "#D45B4F",
  destructiveForeground: "#FFFFFF",
  destructiveSoft: "#2E1C1A",
  success: "#3D9A64",
  successForeground: "#FFFFFF",
  successSoft: "#1A2E24",
  warning: "#D4893A",
  warningForeground: "#161410",
  warningSoft: "#2E2418",
  border: "#322F2A",
  input: "#322F2A",
  inputFill: "#1C1A17",
  ring: "#5B8FFF",

  white: "#FFFFFF",
  black: "#161410",
  skeleton: "#322F2A",

  status: {
    pending: "#2E2418",
    pendingForeground: "#D4893A",
    progress: "#1A2744",
    progressForeground: "#5B8FFF",
    ready: "#1A2E24",
    readyForeground: "#3D9A64",
    success: "#1A2E24",
    successForeground: "#3D9A64",
    neutral: "#211F1A",
    neutralForeground: "#9B968B",
    danger: "#2E1C1A",
    dangerForeground: "#D45B4F",
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

  overlay: "rgba(0, 0, 0, 0.45)",

  icon: {
    default: "#9B968B",
    muted: "#7A7570",
    active: "#EDEBE6",
    inactive: "#7A7570",
  },

  activityIndicator: {
    onPrimary: "#161410",
    onBackground: "#EDEBE6",
  },
} as const;

export type ColorPalette = typeof lightPalette;

export const spacing = {
  "2xs": 2,
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
  card: 22,
  nav: 24,
  pill: 25,
  authPanel: 28,
  sheet: 30,
  full: 9999,
} as const;

export const hitTarget = {
  min: 44,
  field: 64,
  auth: 54,
  /** Canvas list row minimum (ProductRow, later Order/Customer rows). */
  row: 88,
} as const;

export const iconSize = {
  sm: 18,
  md: 20,
} as const;

/**
 * iOS squircle (`CACornerCurve.continuous`). Current on RN 0.86 View style
 * props — not deprecated. Android ignores it. Skip on `radii.full` capsules.
 * Do not confuse with legacy `shadow*` / `elevation`, which `boxShadow`
 * replaces on the New Architecture.
 */
export const squircle = {
  borderCurve: "continuous",
} as const;

export type TypeScale = {
  readonly fontSize: number;
  readonly lineHeight: number;
};

export const typography = {
  "2xs": { fontSize: 11, lineHeight: 14 },
  xs: { fontSize: 13, lineHeight: 18 },
  sm: { fontSize: 14, lineHeight: 20 },
  base: { fontSize: 15, lineHeight: 22 },
  md: { fontSize: 16, lineHeight: 22 },
  lg: { fontSize: 18, lineHeight: 24 },
  xl: { fontSize: 20, lineHeight: 26 },
  "2xl": { fontSize: 24, lineHeight: 30 },
  "3xl": { fontSize: 28, lineHeight: 34 },
  "4xl": { fontSize: 32, lineHeight: 38 },
  display: { fontSize: 44, lineHeight: 44 },
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
  sm: { boxShadow: "0 1px 2px rgba(28, 28, 26, 0.05)" },
  md: { boxShadow: "0 4px 12px rgba(28, 28, 26, 0.12)" },
  lg: { boxShadow: "0 8px 24px rgba(28, 28, 26, 0.16)" },
  xl: { boxShadow: "0 12px 32px rgba(28, 28, 26, 0.18)" },
  auth: { boxShadow: "0 14px 40px rgba(28, 28, 26, 0.10)" },
  nav: { boxShadow: "0 8px 24px rgba(28, 28, 26, 0.10)" },
  accent: { boxShadow: "0 6px 16px rgba(47, 111, 237, 0.28)" },
} as const;

export type GlassFallback = {
  readonly backgroundColor: string;
  readonly borderWidth: number;
  readonly borderColor?: string;
};

export const lightGlassFallback: GlassFallback = {
  backgroundColor: "rgba(255, 255, 255, 0.92)",
  borderWidth: 0.5,
  borderColor: "rgba(229, 226, 218, 1)",
};

export const lightGlassFallbackDense: GlassFallback = {
  backgroundColor: "rgba(255, 255, 255, 0.97)",
  borderWidth: 0,
};

export const lightGlassFallbackPressed: GlassFallback = {
  backgroundColor: "#E5E2DA",
  borderWidth: 0.5,
  borderColor: "#E5E2DA",
};

export const darkGlassFallback: GlassFallback = {
  backgroundColor: "rgba(33, 31, 26, 0.92)",
  borderWidth: 0.5,
  borderColor: "rgba(50, 47, 42, 1)",
};

export const darkGlassFallbackDense: GlassFallback = {
  backgroundColor: "rgba(33, 31, 26, 0.97)",
  borderWidth: 0,
};

export const darkGlassFallbackPressed: GlassFallback = {
  backgroundColor: "rgba(50, 47, 42, 0.97)",
  borderWidth: 0.5,
  borderColor: "rgba(50, 47, 42, 1)",
};
