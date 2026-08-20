import { describe, expect, it } from "vitest";

import { darkTheme } from "./dark";
import { lightTheme } from "./light";
import {
  avatarSizes,
  companyAvatarSizes,
  darkPalette,
  hitTarget,
  lightGlassFallback,
  lightGlassFallbackDense,
  lightPalette,
  radii,
  shadows,
  spacing,
  typography,
} from "./tokens";

describe("canvas token map (ADR-0024)", () => {
  it("pins light roles from the Magic Patterns canvas", () => {
    expect(lightPalette.background).toBe("#F7F6F2");
    expect(lightPalette.foreground).toBe("#1C1C1A");
    expect(lightPalette.card).toBe("#FFFFFF");
    expect(lightPalette.popover).toBe("#FFFFFF");
    expect(lightPalette.primary).toBe("#1C1C1A");
    expect(lightPalette.primaryForeground).toBe("#FFFFFF");
    expect(lightPalette.secondary).toBe("#E5E2DA");
    expect(lightPalette.muted).toBe("#E5E2DA");
    expect(lightPalette.mutedForeground).toBe("#6E6A61");
    expect(lightPalette.accent).toBe("#2F6FED");
    expect(lightPalette.accentSoft).toBe("#E8F0FF");
    expect(lightPalette.ring).toBe("#2F6FED");
    expect(lightPalette.border).toBe("#E5E2DA");
    expect(lightPalette.input).toBe("#E5E2DA");
    expect(lightPalette.inputFill).toBe("#F7F6F2");
    expect(lightPalette.destructive).toBe("#C0392B");
    expect(lightPalette.destructiveSoft).toBe("#FBEAE7");
    expect(lightPalette.success).toBe("#237A4B");
    expect(lightPalette.successSoft).toBe("#E6F2EA");
    expect(lightPalette.warning).toBe("#A65A16");
    expect(lightPalette.warningSoft).toBe("#FBEFE1");
    expect(lightPalette.overlay).toBe("rgba(28, 28, 26, 0.35)");
    expect(lightPalette.icon.muted).toBe("#9B968B");
  });

  it("maps the same roles in dark instead of inventing a second language", () => {
    expect(darkPalette.background).toBe("#161410");
    expect(darkPalette.foreground).toBe("#EDEBE6");
    expect(darkPalette.card).toBe("#211F1A");
    expect(darkPalette.accent).toBe("#5B8FFF");
    expect(darkPalette.accentSoft).toBe("#1A2744");
    expect(darkPalette.ring).toBe("#5B8FFF");
    expect(darkPalette.border).toBe("#322F2A");
    expect(darkPalette.destructive).toBe("#D45B4F");
    expect(darkPalette.success).toBe("#3D9A64");
    expect(darkPalette.warning).toBe("#D4893A");
  });

  it("pins spacing, canvas radii, type, and hit targets", () => {
    expect(Object.values(spacing)).toEqual([4, 8, 12, 16, 20, 24, 32]);
    expect(radii).toEqual({
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
      card: 22,
      nav: 24,
      pill: 25,
      sheet: 30,
      full: 9999,
    });
    expect(hitTarget).toEqual({ min: 44, auth: 54 });
    expect(typography.xs).toEqual({ fontSize: 13, lineHeight: 18 });
    expect(typography.base).toEqual({ fontSize: 15, lineHeight: 22 });
    expect(typography.xl).toEqual({ fontSize: 20, lineHeight: 26 });
    expect(typography["3xl"]).toEqual({ fontSize: 28, lineHeight: 34 });
    expect(avatarSizes).toEqual({ sm: 32, md: 42, lg: 80, xl: 96 });
    expect(companyAvatarSizes.md.dimension).toBe(44);
  });

  it("uses ink-tinted card shadow from the canvas", () => {
    expect(shadows.sm.shadowColor).toBe("#1C1C1A");
    expect(shadows.sm.shadowOffset).toEqual({ width: 0, height: 1 });
    expect(shadows.sm.shadowOpacity).toBe(0.05);
    expect(shadows.sm.elevation).toBe(1);
  });

  it("keeps glass fallbacks on canvas white / line", () => {
    expect(lightGlassFallback.backgroundColor).toBe(
      "rgba(255, 255, 255, 0.92)",
    );
    expect(lightGlassFallbackDense.backgroundColor).toBe(
      "rgba(255, 255, 255, 0.97)",
    );
  });

  it("binds light and dark themes to the same geometry", () => {
    expect(lightTheme.spacing).toBe(spacing);
    expect(darkTheme.spacing).toBe(spacing);
    expect(lightTheme.radii).toBe(radii);
    expect(darkTheme.radii).toBe(radii);
    expect(lightTheme.hitTarget).toBe(hitTarget);
    expect(darkTheme.hitTarget).toBe(hitTarget);
    expect(lightTheme.typography).toBe(typography);
    expect(darkTheme.colors).toBe(darkPalette);
    expect(lightTheme.colors).toBe(lightPalette);
  });
});
