import { describe, expect, it } from "vitest";

import { priceListEntryKey } from "./price-list-form-draft";
import {
  catalogProductsForForm,
  variantsFromGetProduct,
  visiblePriceEntries,
} from "./price-list-form-rows";

const PRODUCT_A = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B = "22222222-2222-4222-8222-222222222222";
const VARIANT_A = "33333333-3333-4333-8333-333333333333";

describe("visiblePriceEntries", () => {
  const products = catalogProductsForForm([
    {
      id: PRODUCT_A,
      name: "Наполеон",
      basePriceMinor: "150000",
      variantCount: 1,
      status: "archived",
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
      key: priceListEntryKey(PRODUCT_A, VARIANT_A),
      productId: PRODUCT_A,
      variantId: VARIANT_A,
    },
    {
      key: priceListEntryKey(PRODUCT_B, null),
      productId: PRODUCT_B,
      variantId: null,
    },
  ];

  it("hides variant rows until expand and filters locally by product name", () => {
    const collapsed = visiblePriceEntries({
      products,
      fields,
      query: "",
      expandedProductIds: new Set(),
      expandingProductIds: new Set(),
      variantMeta: new Map(),
    });
    expect(collapsed.map((row) => row.kind)).toEqual(["product", "product"]);
    expect(collapsed[0]?.archived).toBe(true);
    expect(collapsed[0]?.showExpand).toBe(true);
    expect(collapsed[1]?.showExpand).toBe(false);

    const searched = visiblePriceEntries({
      products,
      fields,
      query: "мед",
      expandedProductIds: new Set(),
      expandingProductIds: new Set(),
      variantMeta: new Map(),
    });
    expect(searched).toHaveLength(1);
    expect(searched[0]?.productId).toBe(PRODUCT_B);
  });

  it("shows expanded variant rows with getProduct names, not a new list action", () => {
    const [variant] = variantsFromGetProduct([
      {
        id: VARIANT_A,
        name: "1 кг",
        status: "archived",
        basePriceMinor: "180000",
      },
    ]);
    if (variant === undefined) {
      throw new Error("expected a variant");
    }
    const rows = visiblePriceEntries({
      products,
      fields,
      query: "наполеон",
      expandedProductIds: new Set([PRODUCT_A]),
      expandingProductIds: new Set(),
      variantMeta: new Map([
        [
          VARIANT_A,
          {
            name: variant.name,
            archived: variant.archived,
            basePriceMinor: variant.basePriceMinor,
          },
        ],
      ]),
    });
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      kind: "variant",
      name: "1 кг",
      archived: true,
      variantId: VARIANT_A,
      basePriceMinor: "180000",
    });
  });
});
