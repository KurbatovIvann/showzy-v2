import { describe, expect, it } from "vitest";

import {
  CREATE_PRODUCT_MAX_VARIANTS,
  DEFAULT_PRODUCT_CURRENCY,
  LIST_PRODUCTS_QUERY_MAX,
  PRODUCT_NAME_MAX,
  SET_PRODUCT_IMAGES_MAX,
  catalogNameSchema,
  currencyCodeSchema,
} from "./catalog.js";

describe("@showzy/validation/catalog", () => {
  it("exports the catalog caps and UAH literal previously copied in contracts", () => {
    expect(PRODUCT_NAME_MAX).toBe(120);
    expect(CREATE_PRODUCT_MAX_VARIANTS).toBe(100);
    expect(LIST_PRODUCTS_QUERY_MAX).toBe(100);
    expect(SET_PRODUCT_IMAGES_MAX).toBe(10);
    expect(DEFAULT_PRODUCT_CURRENCY).toBe("UAH");
  });

  it("trims catalog names, rejects blank and oversize, and accepts only UAH", () => {
    expect(catalogNameSchema.parse("  Київський торт  ")).toBe(
      "Київський торт",
    );
    expect(catalogNameSchema.safeParse("   ").success).toBe(false);
    expect(
      catalogNameSchema.safeParse("x".repeat(PRODUCT_NAME_MAX)).success,
    ).toBe(true);
    expect(
      catalogNameSchema.safeParse("x".repeat(PRODUCT_NAME_MAX + 1)).success,
    ).toBe(false);
    expect(currencyCodeSchema.parse("UAH")).toBe("UAH");
    expect(currencyCodeSchema.safeParse("USD").success).toBe(false);
    expect(currencyCodeSchema.safeParse("uah").success).toBe(false);
  });
});
