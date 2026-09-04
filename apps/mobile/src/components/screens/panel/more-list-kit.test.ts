import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("More hub management rows adopt one-surface chrome", () => {
  it("wraps management rows in ListSurface and keeps session identity on Card", () => {
    const screen = readFileSync(
      new URL("./more-screen.tsx", import.meta.url),
      "utf8",
    );
    expect(screen).toContain("ListSurface");
    expect(screen).toContain("ListRow");
    expect(screen).toContain("<ListRow first>");
    expect(screen).not.toContain("divided");
    expect(screen).toContain("<Card>");
    expect(screen).toContain("auth.session.userId");
  });
});
