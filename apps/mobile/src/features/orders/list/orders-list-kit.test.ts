import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

describe("orders list adopts one-surface chrome", () => {
  it("wraps grouped rows in ListRow groupEdge and keeps sticky headers on canvas", () => {
    const view = read("./orders-list-view.tsx");
    const row = read("./order-row.tsx");
    expect(view).toContain("ListSurface");
    expect(view).toContain("ListRow");
    expect(view).toContain("orderListGroupEdge");
    expect(view).toContain("stickyHeaderIndices");
    expect(view).not.toContain("ItemSeparatorComponent");
    expect(view).not.toContain("provisional");
    expect(row).toContain("memo(function OrderRow");
    expect(row).not.toContain("theme.shadows.sm");
    expect(row).not.toContain("borderWidth: 1");
  });
});
