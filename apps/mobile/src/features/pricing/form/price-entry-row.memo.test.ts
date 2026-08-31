import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { priceListEntryKey, originFromDraft } from "./price-list-form-draft";
import { presentPriceListFormRows } from "./price-list-form.presenter";
import { catalogProductsForForm } from "./price-list-form-rows";

const PRODUCT_A = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B = "22222222-2222-4222-8222-222222222222";

function shallowEqual(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) {
    return false;
  }
  return keys.every((key) => Object.is(left[key], right[key]));
}

describe("price entry row memo", () => {
  it("keeps unrelated row primitives equal when another origin price changes", () => {
    const products = catalogProductsForForm([
      {
        id: PRODUCT_A,
        name: "Наполеон",
        basePriceMinor: "150000",
        variantCount: 0,
        status: "active",
      },
      {
        id: PRODUCT_B,
        name: "Медовик",
        basePriceMinor: "120000",
        variantCount: 0,
        status: "active",
      },
    ]);
    const fields = [
      {
        key: priceListEntryKey(PRODUCT_A, null),
        productId: PRODUCT_A,
        variantId: null,
      },
      {
        key: priceListEntryKey(PRODUCT_B, null),
        productId: PRODUCT_B,
        variantId: null,
      },
    ];
    const originA = originFromDraft({
      name: "Опт",
      isDefault: false,
      isActive: true,
      entries: [
        {
          key: priceListEntryKey(PRODUCT_A, null),
          productId: PRODUCT_A,
          variantId: null,
          priceText: "10",
        },
        {
          key: priceListEntryKey(PRODUCT_B, null),
          productId: PRODUCT_B,
          variantId: null,
          priceText: "12",
        },
      ],
    });
    const originB = originFromDraft({
      name: "Опт",
      isDefault: false,
      isActive: true,
      entries: [
        {
          key: priceListEntryKey(PRODUCT_A, null),
          productId: PRODUCT_A,
          variantId: null,
          priceText: "10",
        },
        {
          key: priceListEntryKey(PRODUCT_B, null),
          productId: PRODUCT_B,
          variantId: null,
          priceText: "15",
        },
      ],
    });
    const args = {
      products,
      fields,
      query: "",
      expandedProductIds: new Set<string>(),
      expandingProductIds: new Set<string>(),
      variantMeta: new Map(),
      entryErrors: {},
      priceInvalidCopy: "invalid",
    };
    const before = presentPriceListFormRows({ ...args, origin: originA });
    const afterOtherKeystroke = presentPriceListFormRows({
      ...args,
      origin: originB,
    });
    const left = before[0];
    const right = afterOtherKeystroke[0];
    if (left === undefined || right === undefined) {
      throw new Error("expected product rows");
    }
    const onFieldEdit = () => undefined;
    const onToggleExpand = () => undefined;
    expect(
      shallowEqual(
        {
          fieldIndex: left.fieldIndex,
          originPriceText: left.originPriceText,
          error: left.error,
          name: left.name,
          onFieldEdit,
          onToggleExpand,
        },
        {
          fieldIndex: right.fieldIndex,
          originPriceText: right.originPriceText,
          error: right.error,
          name: right.name,
          onFieldEdit,
          onToggleExpand,
        },
      ),
    ).toBe(true);
    expect(afterOtherKeystroke[1]?.originPriceText).toBe("15");
    expect(left.originPriceText).toBe("10");
  });

  it("wraps PriceEntryRow in memo and virtualizes with stable callbacks", () => {
    const row = readFileSync(
      new URL("./price-entry-row.tsx", import.meta.url),
      "utf8",
    );
    const view = readFileSync(
      new URL("./price-list-form-view.tsx", import.meta.url),
      "utf8",
    );
    const hook = readFileSync(
      new URL("./use-price-list-form.ts", import.meta.url),
      "utf8",
    );
    expect(row).toContain("memo(function PriceEntryRow");
    expect(view).toContain("FlashList");
    expect(view).toContain("item.originPriceText");
    expect(view).toContain("useCallback");
    expect(hook).toContain("useCallback(() => {");
    expect(hook).toContain("toggleExpand: expansion.toggleExpand");
    expect(hook).not.toContain("watch(() => {");
  });
});
