import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

describe("documents list adopts one-surface chrome", () => {
  it("wraps document rows in ListSurface plus hairline ListRow", () => {
    const view = read("./documents-list-view.tsx");
    const row = read("./document-row.tsx");
    expect(view).toContain("ListSurface");
    expect(view).toContain("<ListRow first={index === 0}>");
    expect(view).not.toContain("ItemSeparatorComponent");
    expect(row).toContain("memo(function DocumentRow");
    expect(row).not.toContain("theme.shadows.sm");
    expect(row).not.toContain("borderRadius: theme.radii.xl");
  });
});
