import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(new URL("./button.tsx", import.meta.url), "utf8");

describe("Button canvas control (SHO-389)", () => {
  it("uses control type 16 (typography.md) for every variant", () => {
    expect(SOURCE).toContain("theme.typography.md.fontSize");
    expect(SOURCE).not.toContain("theme.typography.lg.fontSize");
    expect(SOURCE).not.toContain("theme.typography.sm.fontSize");
  });

  it("uses 35% opacity for primary disabled, not a faint fill", () => {
    expect(SOURCE).toContain("theme.disabledOpacity");
    expect(SOURCE).toContain("disabledPrimary");
    expect(SOURCE).not.toContain("disabledLg");
    expect(SOURCE).not.toContain("theme.colors.icon.muted");
  });
});
