import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SHEET_SOURCE = readFileSync(
  new URL("./sheet.tsx", import.meta.url),
  "utf8",
);

/**
 * Known `<Sheet` call sites. Vitest is node-only with a `readFileSync`
 * stub (no `readdirSync`); pin the current set so a missing close label
 * fails this test instead of walking the tree.
 */
const SHEET_CALL_SITES = [
  "../../features/catalog/products/detail/product-actions-sheet.tsx",
  "../../features/catalog/products/detail/variant-actions-sheet.tsx",
  "../../features/catalog/products/form/variant-editor-sheet.tsx",
  "../../features/catalog/products/photos/photo-source-sheet.tsx",
  "../../features/customers/invitations/invitation-form-view.tsx",
  "./option-select-sheet.tsx",
  "../../features/documents/list/document-options-sheet.tsx",
  "../../features/documents/share/document-handover-sheet.tsx",
  "../../features/documents/signing/document-signing-sheet.tsx",
  "../../features/orders/detail/order-actions-sheet.tsx",
  "../../features/orders/form/product-select-sheet.tsx",
  "../../features/orders/list/orders-filter-sheet.tsx",
  "../../features/pricing/list/price-list-options-sheet.tsx",
] as const;

describe("Sheet always exposes a dismiss control", () => {
  it("renders the close Pressable without gating on an optional label", () => {
    expect(SHEET_SOURCE).toContain("closeAccessibilityLabel: string");
    expect(SHEET_SOURCE).not.toContain("closeAccessibilityLabel?:");
    expect(SHEET_SOURCE).toContain("<SheetHeader");
    expect(SHEET_SOURCE).toContain("useSheetPresentation(");
    expect(SHEET_SOURCE).toContain(
      "accessibilityLabel={props.closeAccessibilityLabel}",
    );
    expect(SHEET_SOURCE).not.toContain("closeLabel !== null");
  });

  it("passes closeAccessibilityLabel at every Sheet call site", () => {
    for (const relative of SHEET_CALL_SITES) {
      const source = readFileSync(new URL(relative, import.meta.url), "utf8");
      expect(source).toMatch(/<Sheet\b/);
      expect(source).toContain("closeAccessibilityLabel=");
    }
  });
});
