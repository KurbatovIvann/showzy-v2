import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("orders list row memo", () => {
  it("stabilizes openOrder and memoizes OrderRow with an id-based onPress", () => {
    const hook = readFileSync(
      new URL("./use-orders-list.ts", import.meta.url),
      "utf8",
    );
    const names = readFileSync(
      new URL("./use-order-customer-names.ts", import.meta.url),
      "utf8",
    );
    const row = readFileSync(
      new URL("./order-row.tsx", import.meta.url),
      "utf8",
    );
    const view = readFileSync(
      new URL("./orders-list-view.tsx", import.meta.url),
      "utf8",
    );
    expect(hook).toContain("const openOrder = useCallback(");
    expect(names).toContain("retainCustomerNameHydrationMap");
    expect(row).toContain("memo(function OrderRow");
    expect(row).toContain("onPress: (id: string) => void");
    expect(view).toContain("onPress={openOrder}");
  });
});
