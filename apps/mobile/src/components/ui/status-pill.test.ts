import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  new URL("./status-pill.tsx", import.meta.url),
  "utf8",
);

describe("StatusPill focus tone (SHO-376)", () => {
  it("declares focus among the canvas tones", () => {
    expect(SOURCE).toContain('"focus"');
    expect(SOURCE).toContain("focusLabel");
  });

  it("binds focus / focusSoft from the Unistyles theme, not feature hex", () => {
    expect(SOURCE).toContain("theme.colors.focusSoft");
    expect(SOURCE).toContain("theme.colors.focus");
    expect(SOURCE).not.toMatch(/#[0-9A-Fa-f]{6}/);
    expect(SOURCE).not.toContain("#5B4BDB");
    expect(SOURCE).not.toContain("#EEEBFF");
  });
});

describe("StatusPill action tone (SHO-389)", () => {
  it("puts action labels on accentFg over accentSoft (mp-to-mobile)", () => {
    expect(SOURCE).toMatch(
      /action:\s*\{\s*backgroundColor:\s*theme\.colors\.accentSoft/,
    );
    expect(SOURCE).toMatch(
      /actionLabel:\s*\{\s*color:\s*theme\.colors\.accentFg/,
    );
  });
});
