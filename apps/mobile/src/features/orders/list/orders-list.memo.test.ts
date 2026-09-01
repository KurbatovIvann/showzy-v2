import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

describe("orders list row memo", () => {
  it("stabilizes openOrder and memoizes OrderRow with an id-based onPress", () => {
    const hook = readFileSync(
      new URL("./use-orders-list.ts", import.meta.url),
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
    expect(hook).not.toContain("useOrderCustomerNames");
    expect(hook).not.toContain("filterOrdersBySelectedStatuses");
    expect(hook).not.toContain("shouldPageThroughClientStatusFilter");
    expect(row).toContain("memo(function OrderRow");
    expect(row).toContain("onPress: (id: string) => void");
    expect(view).toContain("onPress={openOrder}");
  });
});
