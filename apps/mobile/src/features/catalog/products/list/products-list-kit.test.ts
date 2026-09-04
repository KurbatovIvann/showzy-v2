import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

describe("products list adopts one-surface chrome", () => {
  it("keeps the found-count header beside ListSurface and hairline ListRow", () => {
    const view = read("./products-list-view.tsx");
    const row = read("./product-row.tsx");
    expect(view).toContain("ListSurface");
    expect(view).toContain("<ListRow first={index === 0}>");
    expect(view).toContain("foundCountLabel");
    expect(view).not.toContain("ItemSeparatorComponent");
    expect(row).toContain("memo(function ProductRow");
    expect(row).not.toContain("theme.shadows.sm");
    expect(row).not.toContain("borderWidth: 1");
  });
});
