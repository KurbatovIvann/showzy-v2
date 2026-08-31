import { describe, expect, it } from "vitest";

import { comparePriceListEntryKeys, entryKey } from "./entry-keys.js";

describe("price-list entry keys", () => {
  const productId = "11111111-1111-4111-8111-111111111111";
  const variantId = "22222222-2222-4222-8222-222222222222";

  it("treats omitted, undefined, and null variant as the product-level key", () => {
    expect(entryKey(productId, null)).toBe(`${productId}|`);
    expect(entryKey(productId, undefined)).toBe(`${productId}|`);
    expect(entryKey(productId, variantId)).toBe(`${productId}|${variantId}`);
  });

  it("sorts by productId then variant, with product-level before variants", () => {
    const laterProduct = "33333333-3333-4333-8333-333333333333";
    expect(
      comparePriceListEntryKeys(
        { productId, variantId: null },
        { productId, variantId },
      ),
    ).toBe(-1);
    expect(
      comparePriceListEntryKeys(
        { productId, variantId },
        { productId, variantId: undefined },
      ),
    ).toBe(1);
    expect(
      comparePriceListEntryKeys(
        { productId, variantId: null },
        { productId: laterProduct, variantId: null },
      ),
    ).toBe(-1);
    expect(
      comparePriceListEntryKeys(
        { productId, variantId: null },
        { productId, variantId: null },
      ),
    ).toBe(0);
  });
});
