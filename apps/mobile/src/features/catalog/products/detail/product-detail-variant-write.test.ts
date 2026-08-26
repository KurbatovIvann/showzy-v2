import { describe, expect, it } from "vitest";

import { productsCopy } from "../../../../i18n/products";
import { PRODUCT_FORM_MAX_VARIANTS } from "../form/product-form-model";
import {
  detailVariantBanner,
  detailVariantToDraft,
  planDetailVariantWrite,
} from "./product-detail-variant-write";
import type { ProductVariantView } from "./product-detail-model";

const PRODUCT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const VARIANT_ID = "11111111-1111-4111-8111-111111111111";

const variant: ProductVariantView = {
  id: VARIANT_ID,
  name: "1 кг",
  archived: false,
  priceLabel: "1 800 ₴",
  priceInherited: false,
  priceMinor: "180000",
};

describe("planDetailVariantWrite", () => {
  it("creates a variant with an inherited price", () => {
    const plan = planDetailVariantWrite({
      productId: PRODUCT_ID,
      variantCount: 1,
      existing: null,
      name: "Міні",
      priceText: "",
    });
    expect(plan).toEqual({
      kind: "write",
      write: {
        kind: "createVariant",
        key: "new",
        input: { productId: PRODUCT_ID, name: "Міні" },
      },
    });
  });

  it("updates a variant name and custom price", () => {
    const plan = planDetailVariantWrite({
      productId: PRODUCT_ID,
      variantCount: 1,
      existing: {
        variantId: VARIANT_ID,
        name: "1 кг",
        priceMinor: "180000",
      },
      name: "2 кг",
      priceText: "20",
    });
    expect(plan).toEqual({
      kind: "write",
      write: {
        kind: "updateVariant",
        key: VARIANT_ID,
        input: {
          productId: PRODUCT_ID,
          variantId: VARIANT_ID,
          name: "2 кг",
          basePriceMinor: "2000",
          currency: "UAH",
        },
      },
    });
  });

  it("is a noop when the variant did not change", () => {
    expect(
      planDetailVariantWrite({
        productId: PRODUCT_ID,
        variantCount: 1,
        existing: {
          variantId: VARIANT_ID,
          name: "1 кг",
          priceMinor: "180000",
        },
        name: "1 кг",
        priceText: "1800",
      }).kind,
    ).toBe("noop");
  });

  it("rejects an empty name and a full catalog", () => {
    expect(
      planDetailVariantWrite({
        productId: PRODUCT_ID,
        variantCount: 0,
        existing: null,
        name: "  ",
        priceText: "",
      }),
    ).toEqual({
      kind: "invalid",
      errors: { name: "required", price: null },
    });
    expect(
      planDetailVariantWrite({
        productId: PRODUCT_ID,
        variantCount: PRODUCT_FORM_MAX_VARIANTS,
        existing: null,
        name: "Міні",
        priceText: "",
      }).kind,
    ).toBe("too_many");
  });
});

describe("detailVariantToDraft", () => {
  it("maps an override onto the form sheet draft and inherit onto empty price", () => {
    expect(detailVariantToDraft(variant)).toEqual({
      key: VARIANT_ID,
      variantId: VARIANT_ID,
      name: "1 кг",
      priceText: "1800",
      archived: false,
    });
    expect(
      detailVariantToDraft({
        ...variant,
        priceMinor: null,
        priceInherited: true,
      })?.priceText,
    ).toBe("");
    expect(detailVariantToDraft(null)).toBeNull();
  });
});

describe("detailVariantBanner", () => {
  it("resolves form error copy including the variant cap", () => {
    const copy = productsCopy("uk").form;
    expect(detailVariantBanner(null, copy)).toBeNull();
    expect(detailVariantBanner("offline", copy)).toBe(copy.errors.offline);
    expect(detailVariantBanner("too_many_variants", copy)).toBe(
      copy.errors.tooManyVariants,
    );
  });
});
