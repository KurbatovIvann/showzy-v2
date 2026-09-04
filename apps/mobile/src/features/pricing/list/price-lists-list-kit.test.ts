import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

describe("price lists adopt one-surface chrome", () => {
  it("wraps rows in ListSurface and keeps the hint outside the card", () => {
    const view = read("./price-lists-list-view.tsx");
    const row = read("./price-list-row.tsx");
    expect(view).toContain("ListSurface");
    expect(view).toContain("<ListRow first={index === 0}>");
    expect(view).toContain("{model.showHint ?");
    expect(view).toContain("{copy.hint}");
    expect(view).not.toContain("ItemSeparatorComponent");
    const surfaceOpen = view.indexOf(
      "<ListSurface style={styles.surfaceFill}>",
    );
    const hintOpen = view.indexOf("{copy.hint}");
    expect(surfaceOpen).toBeGreaterThan(-1);
    expect(hintOpen).toBeGreaterThan(
      view.indexOf("</ListSurface>", surfaceOpen),
    );
    expect(row).toContain("memo(function PriceListRow");
    expect(row).not.toContain("theme.shadows.sm");
    expect(row).not.toContain("borderRadius: theme.radii.xl");
  });
});
