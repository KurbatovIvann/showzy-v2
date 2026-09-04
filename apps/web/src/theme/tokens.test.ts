/**
 * Theme token contract (SHO-311): the canvas palette from
 * `docs/design/mapping/web-panel-chrome.md` §Visual language /
 * `mp-to-mobile.md` is declared as CSS variables, and the shadcn semantic
 * slots alias those variables — so vendored primitives and ported canvas
 * markup consume one theme source. Asserting the stylesheet text keeps the
 * values from drifting silently.
 */
// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Read from disk: Vitest replaces `.css` imports (even `?raw`) with empty
// modules unless CSS processing is enabled.
const tokensCss = readFileSync(
  new URL("./tokens.css", import.meta.url),
  "utf8",
);

const CANVAS_PALETTE: Record<string, string> = {
  canvas: "#f7f6f2",
  surface: "#ffffff",
  ink: "#1c1c1a",
  muted: "#6e6a61",
  faint: "#9b968b",
  line: "#e5e2da",
  action: "#2f6fed",
  actionSoft: "#e8f0ff",
  focus: "#5b4bdb",
  focusSoft: "#eeebff",
  attention: "#a65a16",
  attentionSoft: "#fbefe1",
  success: "#237a4b",
  successSoft: "#e6f2ea",
  danger: "#c0392b",
  dangerSoft: "#fbeae7",
};

/** shadcn slot → canvas token (`mp-to-mobile.md` roles; primary is ink). */
const SHADCN_SLOTS: Record<string, string> = {
  background: "canvas",
  foreground: "ink",
  card: "surface",
  "card-foreground": "ink",
  popover: "surface",
  "popover-foreground": "ink",
  border: "line",
  input: "line",
  "muted-foreground": "muted",
  primary: "ink",
  "primary-foreground": "surface",
  destructive: "danger",
  "destructive-foreground": "surface",
  ring: "action",
};

describe("canvas theme tokens (SHO-311)", () => {
  it.each(Object.entries(CANVAS_PALETTE))(
    "declares --color-%s as a CSS variable with the canvas value",
    (token, hex) => {
      expect(tokensCss).toContain(`--color-${token}: ${hex};`);
    },
  );

  it.each(Object.entries(SHADCN_SLOTS))(
    "aliases the shadcn slot --color-%s onto the %s token",
    (slot, token) => {
      expect(tokensCss).toContain(`--color-${slot}: var(--color-${token});`);
    },
  );

  it("uses the system font stack — no webfont", () => {
    expect(tokensCss).toContain("--font-sans:");
    expect(tokensCss).toContain("ui-sans-serif, system-ui, -apple-system");
    expect(tokensCss).not.toMatch(/@import url|@font-face/);
  });

  it("declares the canvas radii and shadows", () => {
    expect(tokensCss).toContain("--radius-field: 16px;");
    expect(tokensCss).toContain("--radius-card: 22px;");
    expect(tokensCss).toContain("--radius-panel: 28px;");
    expect(tokensCss).toContain(
      "--shadow-card: 0 1px 2px rgba(28, 28, 26, 0.05);",
    );
  });
});
