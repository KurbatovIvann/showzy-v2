import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(new URL("./bottom-nav.tsx", import.meta.url), "utf8");

describe("BottomNav canvas chrome (SHO-389)", () => {
  it("uses sit.svg in an actionSoft circle, not Sparkles", () => {
    expect(SOURCE).toContain("sit.svg");
    expect(SOURCE).toContain("theme.colors.accentSoft");
    expect(SOURCE).not.toContain("SparklesIcon");
  });

  it("keeps the AI label on actionFg and drops the accent glow", () => {
    expect(SOURCE).toContain("theme.colors.accentFg");
    expect(SOURCE).not.toContain("theme.shadows.accent");
    expect(SOURCE).toContain("theme.colors.background");
  });
});
