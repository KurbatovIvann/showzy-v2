import { describe, expect, it } from "vitest";

import { PRODUCT_NAME_MAX } from "../wire.contract.js";
import {
  createVariantContract,
  createVariantInputSchema,
  createVariantOutputSchema,
} from "./create-variant.contract.js";

const validCreate = {
  productId: "11111111-1111-4111-8111-111111111111",
  name: "Slice",
};

describe("catalog.createVariant contract", () => {
  it("is an idempotent audited staff client write with products:edit and no events", () => {
    expect(createVariantContract.name).toBe("catalog.createVariant");
    expect(createVariantContract.principal).toBe("staff");
    expect(createVariantContract.transport).toBe("client");
    expect(createVariantContract.risk).toBe("write");
    expect(createVariantContract.permissions).toEqual(["products:edit"]);
    expect(createVariantContract.aiExposure).toBe("exposed");
    expect(createVariantContract.requiresConfirmation).toBe(false);
    expect(createVariantContract.idempotent).toBe(true);
    expect(createVariantContract.audit).toBe(true);
    expect(createVariantContract.emits).toEqual([]);
    expect(createVariantContract.atomicCalls).toEqual([]);
    expect(createVariantContract.atomicCallers).toEqual([]);
    expect(createVariantContract.timeout).toBe(5_000);
    expect(createVariantContract.rateLimit).toBeUndefined();
    expect(PRODUCT_NAME_MAX).toBe(120);
    expect(Object.keys(createVariantOutputSchema.shape).toSorted()).toEqual([
      "basePriceMinor",
      "currency",
      "name",
      "productId",
      "variantId",
    ]);
  });

  it("trims the name and accepts a paired override", () => {
    expect(
      createVariantInputSchema.parse({
        ...validCreate,
        name: "  Київський торт  ",
      }).name,
    ).toBe("Київський торт");
    expect(
      createVariantInputSchema.parse({
        ...validCreate,
        basePriceMinor: "50",
        currency: "UAH",
      }),
    ).toEqual({
      productId: validCreate.productId,
      name: "Slice",
      basePriceMinor: "50",
      currency: "UAH",
    });
  });

  it("rejects blank names, unpaired override currency, negative prices, and non-UAH currency", () => {
    expect(
      createVariantInputSchema.safeParse({
        ...validCreate,
        name: "   ",
      }).success,
    ).toBe(false);
    expect(
      createVariantInputSchema.safeParse({
        ...validCreate,
        name: "x".repeat(PRODUCT_NAME_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      createVariantInputSchema.safeParse({
        ...validCreate,
        currency: "UAH",
      }).success,
    ).toBe(false);
    expect(
      createVariantInputSchema.safeParse({
        ...validCreate,
        basePriceMinor: "50",
      }).success,
    ).toBe(false);
    expect(
      createVariantInputSchema.safeParse({
        ...validCreate,
        basePriceMinor: "-1",
        currency: "UAH",
      }).success,
    ).toBe(false);
    expect(
      createVariantInputSchema.safeParse({
        ...validCreate,
        basePriceMinor: "9223372036854775808",
        currency: "UAH",
      }).success,
    ).toBe(false);
    expect(
      createVariantInputSchema.safeParse({
        ...validCreate,
        basePriceMinor: "50",
        currency: "USD",
      }).success,
    ).toBe(false);
    expect(
      createVariantInputSchema.safeParse({
        ...validCreate,
        basePriceMinor: "50",
        currency: "uah",
      }).success,
    ).toBe(false);
    expect(
      createVariantInputSchema.safeParse({
        ...validCreate,
        productId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });

  it("rejects identifier fields — the input is strict", () => {
    for (const extra of [
      { companyId: "c" },
      { variantId: "v" },
      { userId: "u" },
      { status: "archived" },
    ]) {
      expect(
        createVariantInputSchema.safeParse({ ...validCreate, ...extra })
          .success,
      ).toBe(false);
    }
  });
});
