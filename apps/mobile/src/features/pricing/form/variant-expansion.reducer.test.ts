import { describe, expect, it } from "vitest";

import {
  IDLE_VARIANT_EXPANSION,
  reduceVariantExpansion,
} from "./variant-expansion.reducer";

const PRODUCT_A = "11111111-1111-4111-8111-111111111111";
const VARIANT_A = "33333333-3333-4333-8333-333333333333";

const VARIANT = {
  id: VARIANT_A,
  name: "1 кг",
  basePriceMinor: "180000",
  archived: false,
};

describe("reduceVariantExpansion", () => {
  it("is a no-op when collapsing a product that is not expanded", () => {
    expect(
      reduceVariantExpansion(IDLE_VARIANT_EXPANSION, {
        type: "collapse",
        productId: PRODUCT_A,
      }),
    ).toBe(IDLE_VARIANT_EXPANSION);
  });

  it("marks a product expanding and ignores a second begin", () => {
    const expanding = reduceVariantExpansion(IDLE_VARIANT_EXPANSION, {
      type: "beginExpand",
      productId: PRODUCT_A,
    });
    expect(expanding.expandingProductIds.has(PRODUCT_A)).toBe(true);
    expect(expanding.expandedProductIds.has(PRODUCT_A)).toBe(false);
    expect(
      reduceVariantExpansion(expanding, {
        type: "beginExpand",
        productId: PRODUCT_A,
      }),
    ).toBe(expanding);
  });

  it("clears expanding on failure without expanding", () => {
    const expanding = reduceVariantExpansion(IDLE_VARIANT_EXPANSION, {
      type: "beginExpand",
      productId: PRODUCT_A,
    });
    const failed = reduceVariantExpansion(expanding, {
      type: "expandFailed",
      productId: PRODUCT_A,
    });
    expect(failed.expandingProductIds.has(PRODUCT_A)).toBe(false);
    expect(failed.expandedProductIds.has(PRODUCT_A)).toBe(false);
    expect(
      reduceVariantExpansion(IDLE_VARIANT_EXPANSION, {
        type: "expandFailed",
        productId: PRODUCT_A,
      }),
    ).toBe(IDLE_VARIANT_EXPANSION);
  });

  it("records variant meta and expanded on success, then collapses", () => {
    const expanding = reduceVariantExpansion(IDLE_VARIANT_EXPANSION, {
      type: "beginExpand",
      productId: PRODUCT_A,
    });
    const expanded = reduceVariantExpansion(expanding, {
      type: "expandSucceeded",
      productId: PRODUCT_A,
      variants: [VARIANT],
    });
    expect(expanded.expandedProductIds.has(PRODUCT_A)).toBe(true);
    expect(expanded.expandingProductIds.has(PRODUCT_A)).toBe(false);
    expect(expanded.variantMeta.get(VARIANT_A)).toEqual({
      name: "1 кг",
      archived: false,
      basePriceMinor: "180000",
    });
    const collapsed = reduceVariantExpansion(expanded, {
      type: "collapse",
      productId: PRODUCT_A,
    });
    expect(collapsed.expandedProductIds.has(PRODUCT_A)).toBe(false);
    expect(collapsed.variantMeta.get(VARIANT_A)).toEqual({
      name: "1 кг",
      archived: false,
      basePriceMinor: "180000",
    });
  });
});
