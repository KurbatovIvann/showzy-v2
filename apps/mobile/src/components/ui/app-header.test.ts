import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  new URL("./app-header.tsx", import.meta.url),
  "utf8",
);

describe("AppHeader canvas title (SHO-389)", () => {
  it("uses typography.title for the screen title", () => {
    expect(SOURCE).toContain("theme.typography.title.fontSize");
    expect(SOURCE).toContain("theme.typography.title.lineHeight");
    expect(SOURCE).not.toContain("theme.typography.xl.fontSize");
  });

  it("exposes an optional leading slot", () => {
    expect(SOURCE).toContain("readonly leading?: ReactNode");
    expect(SOURCE).toContain("styles.leading");
  });
});
