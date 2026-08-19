import { describe, expect, it } from "vitest";

import { darkTheme } from "./dark";
import { lightTheme } from "./light";
import {
  avatarSizes,
  companyAvatarSizes,
  darkPalette,
  lightGlassFallback,
  lightGlassFallbackDense,
  lightPalette,
  radii,
  shadows,
  spacing,
  typography,
} from "./tokens";

describe("V1 token transcription (ADR-0019)", () => {
  it("pins inventory color roles for light and dark", () => {
    expect(lightPalette.background).toBe("#F0EDE7");
    expect(lightPalette.foreground).toBe("#1A1814");
    expect(lightPalette.card).toBe("#FDFCFA");
    expect(lightPalette.popover).toBe("#FDFCFA");
    expect(lightPalette.primary).toBe("#1C1A15");
    expect(lightPalette.secondary).toBe("#E8E5DF");
    expect(lightPalette.mutedForeground).toBe("#7A7570");
    expect(lightPalette.accent).toBe("#2684CC");
    expect(lightPalette.ring).toBe("#2684CC");
    expect(lightPalette.border).toBe("#D8D4CC");
    expect(lightPalette.input).toBe("#D8D4CC");
    expect(lightPalette.destructive).toBe("#ef4343");
    expect(lightPalette.success).toBe("#21c45d");
    expect(lightPalette.warning).toBe("#f59f0a");

    expect(darkPalette.background).toBe("#161410");
    expect(darkPalette.foreground).toBe("#E6E3DD");
    expect(darkPalette.card).toBe("#211F1A");
    expect(darkPalette.primary).toBe("#E6E3DD");
    expect(darkPalette.secondary).toBe("#2A2722");
    expect(darkPalette.mutedForeground).toBe("#908B84");
    expect(darkPalette.accent).toBe("#5CB0E0");
    expect(darkPalette.ring).toBe("#5CB0E0");
    expect(darkPalette.border).toBe("#322F2A");
    expect(darkPalette.destructive).toBe("#d15147");
    expect(darkPalette.success).toBe("#4ca957");
    expect(darkPalette.warning).toBe("#cd922d");
  });

  it("pins the spacing, radius, type, and avatar scales", () => {
    expect(Object.values(spacing)).toEqual([4, 8, 12, 16, 20, 24, 32]);
    expect(radii).toEqual({
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
      pill: 25,
      full: 9999,
    });
    expect(typography.xs).toEqual({ fontSize: 13, lineHeight: 18 });
    expect(typography.sm).toEqual({ fontSize: 14, lineHeight: 20 });
    expect(typography.base).toEqual({ fontSize: 15, lineHeight: 22 });
    expect(typography.md).toEqual({ fontSize: 16, lineHeight: 22 });
    expect(typography.lg).toEqual({ fontSize: 18, lineHeight: 24 });
    expect(typography.xl).toEqual({ fontSize: 20, lineHeight: 26 });
    expect(typography["2xl"]).toEqual({ fontSize: 24, lineHeight: 30 });
    expect(typography["3xl"]).toEqual({ fontSize: 28, lineHeight: 34 });
    expect(typography["4xl"]).toEqual({ fontSize: 32, lineHeight: 38 });
    expect(avatarSizes).toEqual({ sm: 32, md: 42, lg: 80, xl: 96 });
    expect(companyAvatarSizes.xs.dimension).toBe(32);
    expect(companyAvatarSizes.sm.dimension).toBe(36);
    expect(companyAvatarSizes.md.dimension).toBe(44);
    expect(companyAvatarSizes.lg.dimension).toBe(64);
    expect(companyAvatarSizes.xl.dimension).toBe(120);
  });

  it("uses the warm shadow color at four elevations", () => {
    expect(shadows.sm.shadowColor).toBe("#2A2518");
    expect(shadows.md.shadowColor).toBe("#2A2518");
    expect(shadows.lg.shadowColor).toBe("#2A2518");
    expect(shadows.xl.shadowColor).toBe("#2A2518");
    expect(shadows.sm.elevation).toBe(2);
    expect(shadows.md.elevation).toBe(4);
    expect(shadows.lg.elevation).toBe(8);
    expect(shadows.xl.elevation).toBe(12);
  });

  it("keeps V1 glass fallbacks (inventory 0.85/0.92 was a draft snapshot)", () => {
    expect(lightGlassFallback.backgroundColor).toBe(
      "rgba(253, 252, 250, 0.92)",
    );
    expect(lightGlassFallbackDense.backgroundColor).toBe(
      "rgba(253, 252, 250, 0.97)",
    );
  });

  it("binds light and dark themes to the same geometry", () => {
    expect(lightTheme.spacing).toBe(spacing);
    expect(darkTheme.spacing).toBe(spacing);
    expect(lightTheme.radii).toBe(radii);
    expect(darkTheme.radii).toBe(radii);
    expect(lightTheme.typography).toBe(typography);
    expect(darkTheme.colors).toBe(darkPalette);
    expect(lightTheme.colors).toBe(lightPalette);
  });
});
