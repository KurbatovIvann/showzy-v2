import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Vitest is node-only (no RN), so this pins the route module source
 * instead of mounting screens. Deleting `orders/new.tsx` (so `[id]`
 * would steal `/orders/new`) fails the read.
 */
const CREATE_ROUTE = readFileSync(
  new URL("../../../app/(app)/orders/new.tsx", import.meta.url),
  "utf8",
);
const CREATE_SCREEN = readFileSync(
  new URL("./order-create-screen.tsx", import.meta.url),
  "utf8",
);
const DETAIL_ROUTE = readFileSync(
  new URL("../../../app/(app)/orders/[id]/index.tsx", import.meta.url),
  "utf8",
);

const CREATE_VIEW = readFileSync(
  new URL("./order-form-view.tsx", import.meta.url),
  "utf8",
);
const CREATE_HOOK = readFileSync(
  new URL("./use-order-form.ts", import.meta.url),
  "utf8",
);

describe("orders/new route", () => {
  it("is the create screen, not OrderDetailScreen or the construction placeholder", () => {
    expect(CREATE_ROUTE).toContain("export { OrderCreateScreen as default }");
    expect(CREATE_ROUTE).toContain("features/orders/form/order-create-screen");
    expect(CREATE_ROUTE).not.toContain("OrderDetailScreen");
    expect(CREATE_ROUTE).not.toContain("OrderCreatePlaceholderScreen");
    expect(CREATE_SCREEN).toContain("export function OrderCreateScreen");
    expect(CREATE_SCREEN).not.toContain("OrderDetailScreen");
    expect(CREATE_SCREEN).not.toContain("EmptyState");
    expect(CREATE_SCREEN).not.toContain("ConstructionIcon");
    expect(DETAIL_ROUTE).toContain("export { OrderDetailScreen as default }");
    expect(DETAIL_ROUTE).not.toContain("OrderCreateScreen");
  });

  it("uses a dedicated ProductSelectSheet and does not import catalog", () => {
    expect(CREATE_VIEW).toContain("ProductSelectSheet");
    expect(CREATE_VIEW).toContain("doneCount={model.productPickCount}");
    expect(CREATE_HOOK).toContain("confirmProductPicks");
    expect(CREATE_HOOK).toContain("reduceProductPicker");
    expect(CREATE_HOOK).toContain(
      "productSheetOpen: productPickerOpen(picker)",
    );
    expect(CREATE_HOOK).toContain(
      "productPickerSessionOpen: productPickerOpen(picker)",
    );
    expect(CREATE_VIEW).toContain(
      "sessionOpen={model.productPickerSessionOpen}",
    );
    expect(CREATE_VIEW).toContain("selectedIds={model.selectedVariantIds}");
    expect(CREATE_VIEW).not.toContain("features/catalog");
    expect(CREATE_HOOK).not.toContain("features/catalog");
    expect(CREATE_VIEW).not.toContain("basePriceMinor");
    expect(CREATE_HOOK).not.toContain("basePriceMinor");
  });
});
