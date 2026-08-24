import { describe, expect, it } from "vitest";

import {
  DEFAULT_PRODUCT_CURRENCY,
  PRODUCT_NAME_MAX,
} from "../wire.contract.js";
import {
  CREATE_PRODUCT_MAX_VARIANTS,
  createProductContract,
  createProductInputSchema,
  createProductOutputSchema,
  createProductVariantInputSchema,
} from "./create-product.contract.js";

describe("catalog.createProduct contract", () => {
  it("is an idempotent audited staff client write with products:create and no events", () => {
    expect(createProductContract.name).toBe("catalog.createProduct");
    expect(createProductContract.principal).toBe("staff");
    expect(createProductContract.transport).toBe("client");
    expect(createProductContract.risk).toBe("write");
    expect(createProductContract.permissions).toEqual(["products:create"]);
    expect(createProductContract.aiExposure).toBe("exposed");
    expect(createProductContract.requiresConfirmation).toBe(false);
    expect(createProductContract.idempotent).toBe(true);
    expect(createProductContract.audit).toBe(true);
    expect(createProductContract.emits).toEqual([]);
    expect(createProductContract.atomicCalls).toEqual([]);
    expect(createProductContract.atomicCallers).toEqual([]);
    expect(createProductContract.timeout).toBe(5_000);
    expect(createProductContract.rateLimit).toBeUndefined();
    expect(CREATE_PRODUCT_MAX_VARIANTS).toBe(100);
    expect(PRODUCT_NAME_MAX).toBe(120);
    expect(DEFAULT_PRODUCT_CURRENCY).toBe("UAH");
  });

  it("trims the name, defaults currency to UAH, and defaults variants to empty", () => {
    const parsed = createProductInputSchema.parse({
      name: "  Київський торт  ",
      basePriceMinor: "0",
    });
    expect(parsed).toEqual({
      name: "Київський торт",
      basePriceMinor: "0",
      currency: "UAH",
      variants: [],
    });
    expect(Object.keys(createProductOutputSchema.shape).toSorted()).toEqual([
      "basePriceMinor",
      "currency",
      "name",
      "productId",
      "variants",
    ]);
  });

  it("rejects blank names, negative prices, and unpaired variant currency", () => {
    expect(
      createProductInputSchema.safeParse({
        name: "   ",
        basePriceMinor: "100",
      }).success,
    ).toBe(false);
    expect(
      createProductInputSchema.safeParse({
        name: "x".repeat(PRODUCT_NAME_MAX + 1),
        basePriceMinor: "100",
      }).success,
    ).toBe(false);
    expect(
      createProductInputSchema.safeParse({
        name: "Cake",
        basePriceMinor: "-1",
      }).success,
    ).toBe(false);
    expect(
      createProductVariantInputSchema.safeParse({
        name: "Slice",
        currency: "UAH",
      }).success,
    ).toBe(false);
    expect(
      createProductVariantInputSchema.safeParse({
        name: "Slice",
        basePriceMinor: "50",
      }).success,
    ).toBe(false);
    expect(
      createProductVariantInputSchema.safeParse({
        name: "Slice",
        basePriceMinor: "50",
        currency: "UAH",
      }).success,
    ).toBe(true);
    expect(
      createProductInputSchema.safeParse({
        name: "Cake",
        basePriceMinor: "100",
        variants: Array.from(
          { length: CREATE_PRODUCT_MAX_VARIANTS + 1 },
          (_, index) => ({ name: `V${String(index)}` }),
        ),
      }).success,
    ).toBe(false);
  });

  it("rejects identifier fields — the input is strict", () => {
    const valid = { name: "Cake", basePriceMinor: "100" };
    for (const extra of [
      { companyId: "c" },
      { productId: "p" },
      { userId: "u" },
      { status: "archived" },
    ]) {
      expect(
        createProductInputSchema.safeParse({ ...valid, ...extra }).success,
      ).toBe(false);
    }
  });
});
