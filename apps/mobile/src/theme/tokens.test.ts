import { describe, expect, it } from "vitest";

import { darkTheme } from "./dark";
import { lightTheme } from "./light";
import {
  avatarSizes,
  companyAvatarSizes,
  darkPalette,
  hitTarget,
  iconSize,
  keyboardAppearance,
  lightGlassFallback,
  lightGlassFallbackDense,
  lightPalette,
  otpCellMaxWidth,
  pressedOpacity,
  disabledOpacity,
  radii,
  shadows,
  spacing,
  squircle,
  typography,
} from "./tokens";

describe("canvas token map (ADR-0024)", () => {
  it("pins light roles from the Magic Patterns canvas", () => {
    expect(lightPalette.background).toBe("#F7F6F2");
    expect(lightPalette.foreground).toBe("#1C1C1A");
    expect(lightPalette.card).toBe("#FFFFFF");
    expect(lightPalette.primary).toBe("#1C1C1A");
    expect(lightPalette.primaryForeground).toBe("#FFFFFF");
    expect(lightPalette.muted).toBe("#E5E2DA");
    expect(lightPalette.mutedForeground).toBe("#6E6A61");
    expect(lightPalette.accent).toBe("#4E61DE");
    expect(lightPalette.accentFg).toBe("#4657BD");
    expect(lightPalette.accentSoft).toBe("#EEF3FF");
    expect(lightPalette.focus).toBe("#5B4BDB");
    expect(lightPalette.focusSoft).toBe("#EEEBFF");
    expect(lightPalette.focusForeground).toBe("#FFFFFF");
    expect(lightPalette.ring).toBe("#4E61DE");
    expect(lightPalette.border).toBe("#EFEDE7");
    expect(lightPalette.input).toBe("#EFEDE7");
    expect(lightPalette.inputFill).toBe("#F7F6F2");
    expect(lightPalette.disabled).toBe("#C7C2B8");
    expect(lightPalette.provisional).toBe("#4E61DE");
    expect(lightPalette.provisionalFill).toBe("#EEF3FF");
    expect(lightPalette.provisionalBorder).toBe("#AEBCEC");
    expect(lightPalette.provisionalFg).toBe("#4657BD");
    expect(lightPalette.destructive).toBe("#C0392B");
    expect(lightPalette.destructiveSoft).toBe("#FBEAE7");
    expect(lightPalette.success).toBe("#56633F");
    expect(lightPalette.successSoft).toBe("#E1EECC");
    expect(lightPalette.warning).toBe("#A65A16");
    expect(lightPalette.warningSoft).toBe("#FBEFE1");
    expect(lightPalette.overlay).toBe("rgba(28, 28, 26, 0.35)");
    expect(lightPalette.icon.muted).toBe("#9B968B");
  });

  it("maps the same roles in dark instead of inventing a second language", () => {
    expect(darkPalette.background).toBe("#161410");
    expect(darkPalette.foreground).toBe("#EDEBE6");
    expect(darkPalette.card).toBe("#211F1A");
    expect(darkPalette.accent).toBe("#7A81F0");
    expect(darkPalette.accentFg).toBe("#8B94F5");
    expect(darkPalette.accentSoft).toBe("#1A2448");
    expect(darkPalette.focus).toBe("#8B82FF");
    expect(darkPalette.focusSoft).toBe("#221A44");
    expect(darkPalette.focusForeground).toBe("#161410");
    expect(darkPalette.ring).toBe("#7A81F0");
    expect(darkPalette.border).toBe("#322F2A");
    expect(darkPalette.destructive).toBe("#D45B4F");
    expect(darkPalette.success).toBe("#708358");
    expect(darkPalette.successSoft).toBe("#1E2A18");
    expect(darkPalette.warning).toBe("#D4893A");
    expect(darkPalette.disabled).toBe("#5C574E");
    expect(darkPalette.provisional).toBe("#7A81F0");
    expect(darkPalette.provisionalFill).toBe("#1A2448");
    expect(darkPalette.provisionalBorder).toBe("#3A4270");
    expect(darkPalette.provisionalFg).toBe("#8B94F5");
  });

  it("pins spacing, canvas radii, type, and hit targets", () => {
    expect(Object.values(spacing)).toEqual([2, 4, 8, 12, 16, 20, 24, 32]);
    expect(radii).toEqual({
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
      card: 22,
      nav: 24,
      lgPanel: 28,
      sheet: 30,
      full: 9999,
    });
    expect(hitTarget).toEqual({ min: 44, field: 64, lg: 54, row: 88 });
    expect(iconSize).toEqual({ sm: 18, md: 20 });
    expect(squircle).toEqual({ borderCurve: "continuous" });
    expect(typography["2xs"]).toEqual({ fontSize: 11, lineHeight: 14 });
    expect(typography.xs).toEqual({ fontSize: 13, lineHeight: 18 });
    expect(typography.base).toEqual({ fontSize: 15, lineHeight: 22 });
    expect(typography.md).toEqual({ fontSize: 16, lineHeight: 22 });
    expect(typography.rowTotal).toEqual({ fontSize: 17, lineHeight: 24 });
    expect(typography.lg).toEqual({ fontSize: 18, lineHeight: 24 });
    expect(typography.xl).toEqual({ fontSize: 20, lineHeight: 26 });
    expect(typography["2xl"]).toEqual({ fontSize: 24, lineHeight: 30 });
    expect(typography.title).toEqual({ fontSize: 26, lineHeight: 32 });
    expect(typography["3xl"]).toEqual({ fontSize: 28, lineHeight: 34 });
    expect(typography.headline).toEqual({ fontSize: 30, lineHeight: 36 });
    expect(typography.display).toEqual({ fontSize: 44, lineHeight: 44 });
    expect(avatarSizes).toEqual({ sm: 32, md: 42, lg: 80, xl: 96 });
    expect(companyAvatarSizes.md.dimension).toBe(44);
  });

  it("uses ink-tinted card shadow from the canvas", () => {
    expect(shadows.sm.boxShadow).toBe("0 1px 2px rgba(28, 28, 26, 0.05)");
  });

  it("pins the lg panel shadow from the canvas (0 14px 40px / 10%)", () => {
    expect(shadows.lgPanel.boxShadow).toBe(
      "0 14px 40px rgba(28, 28, 26, 0.10)",
    );
  });

  it("pins the nav cluster and AI control shadows from the canvas", () => {
    expect(shadows.nav.boxShadow).toBe("0 8px 24px rgba(28, 28, 26, 0.08)");
    expect(shadows.accent.boxShadow).toBe(
      "0 6px 16px rgba(78, 97, 222, 0.28)",
    );
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
    expect(lightTheme.iconSize).toBe(iconSize);
    expect(lightTheme.squircle).toBe(squircle);
    expect(lightTheme.typography).toBe(typography);
    expect(darkTheme.colors).toBe(darkPalette);
    expect(lightTheme.colors).toBe(lightPalette);
    expect(lightTheme.pressedOpacity).toBe(pressedOpacity);
    expect(lightTheme.disabledOpacity).toBe(disabledOpacity);
    expect(lightTheme.otpCellMaxWidth).toBe(otpCellMaxWidth);
    expect(darkTheme.pressedOpacity).toBe(pressedOpacity);
    expect(darkTheme.disabledOpacity).toBe(disabledOpacity);
  });

  it("deletes dead palette / geometry tokens (SHO-299)", () => {
    expect("status" in lightPalette).toBe(false);
    expect("status" in darkPalette).toBe(false);
    expect("popover" in lightPalette).toBe(false);
    expect("popoverForeground" in lightPalette).toBe(false);
    expect("secondary" in lightPalette).toBe(false);
    expect("secondaryForeground" in lightPalette).toBe(false);
    expect("white" in lightPalette).toBe(false);
    expect("black" in lightPalette).toBe(false);
    expect("pill" in radii).toBe(false);
    expect("authPanel" in radii).toBe(false);
    expect("md" in shadows).toBe(false);
    expect("xl" in shadows).toBe(false);
    expect("auth" in shadows).toBe(false);
    expect("auth" in hitTarget).toBe(false);
  });

  it("pins pressed opacity, primary disabled opacity, OTP cell width, and keyboard appearance", () => {
    expect(pressedOpacity).toBe(0.85);
    expect(disabledOpacity).toBe(0.35);
    expect(otpCellMaxWidth).toBe(56);
    expect(keyboardAppearance("dark")).toBe("dark");
    expect(keyboardAppearance("light")).toBe("light");
    expect(keyboardAppearance("system")).toBe("light");
    expect(keyboardAppearance(undefined)).toBe("light");
  });
});
