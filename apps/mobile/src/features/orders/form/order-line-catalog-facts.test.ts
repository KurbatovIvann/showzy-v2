import { describe, expect, it } from "vitest";

import {
  catalogFactsFromProduct,
  classifyProductSellability,
  overlayCatalogVariantCount,
  uniqueProductIds,
} from "./order-line-catalog-facts";

const VARIANT_ACTIVE = "44444444-4444-4444-8444-444444444444";
const VARIANT_ARCHIVED = "55555555-5555-4555-8555-555555555555";
const PRODUCT_A = "33333333-3333-4333-8333-333333333333";
const PRODUCT_B = "66666666-6666-4666-8666-666666666666";

describe("classifyProductSellability", () => {
  it("treats zero variant rows as simple", () => {
    expect(classifyProductSellability([])).toBe("simple");
  });

  it("treats any variant rows with an active id as variable", () => {
    expect(
      classifyProductSellability([
        { id: VARIANT_ARCHIVED, status: "archived" },
        { id: VARIANT_ACTIVE, status: "active" },
      ]),
    ).toBe("variable");
  });

  it("treats archived-only rows as unavailable, not simple", () => {
    expect(
      classifyProductSellability([
        { id: VARIANT_ARCHIVED, status: "archived" },
      ]),
    ).toBe("unavailable");
  });
});

describe("overlayCatalogVariantCount / catalogFactsFromProduct", () => {
  it("prefers getProduct row count (including archived) over the list count", () => {
    const facts = catalogFactsFromProduct({
      variants: [{ id: VARIANT_ARCHIVED, status: "archived" }],
    });
    expect(overlayCatalogVariantCount(0, facts)).toBe(1);
    expect(overlayCatalogVariantCount(2, undefined)).toBe(2);
  });
});

describe("uniqueProductIds", () => {
  it("drops empty, null, and duplicate ids without inventing values", () => {
    expect(
      uniqueProductIds([PRODUCT_A, null, "", PRODUCT_A, PRODUCT_B, undefined]),
    ).toEqual([PRODUCT_A, PRODUCT_B]);
  });
});
