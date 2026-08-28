import { describe, expect, it } from "vitest";

import {
  setDefaultPriceListContract,
  setDefaultPriceListInputSchema,
  setDefaultPriceListOutputSchema,
} from "./set-default-price-list.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

describe("pricing.setDefaultPriceList contract", () => {
  it("is an idempotent audited staff client write with pricing:manage and no events", () => {
    expect(setDefaultPriceListContract.name).toBe(
      "pricing.setDefaultPriceList",
    );
    expect(setDefaultPriceListContract.principal).toBe("staff");
    expect(setDefaultPriceListContract.transport).toBe("client");
    expect(setDefaultPriceListContract.risk).toBe("write");
    expect(setDefaultPriceListContract.permissions).toEqual(["pricing:manage"]);
    expect(setDefaultPriceListContract.aiExposure).toBe("exposed");
    expect(setDefaultPriceListContract.requiresConfirmation).toBe(false);
    expect(setDefaultPriceListContract.idempotent).toBe(true);
    expect(setDefaultPriceListContract.audit).toBe(true);
    expect(setDefaultPriceListContract.emits).toEqual([]);
    expect(setDefaultPriceListContract.atomicCalls).toEqual([]);
    expect(setDefaultPriceListContract.atomicCallers).toEqual([]);
    expect(setDefaultPriceListContract.timeout).toBe(5_000);
    expect(setDefaultPriceListContract.rateLimit).toBeUndefined();
  });

  it("accepts a uuid or null and shares the getPriceList view, nullable on clear", () => {
    expect(
      setDefaultPriceListInputSchema.parse({ priceListId: validId }),
    ).toEqual({ priceListId: validId });
    expect(setDefaultPriceListInputSchema.parse({ priceListId: null })).toEqual(
      { priceListId: null },
    );
    expect(setDefaultPriceListOutputSchema.safeParse(null).success).toBe(true);
    expect(
      setDefaultPriceListOutputSchema.safeParse({
        id: validId,
        name: "Wholesale",
        isDefault: true,
        isActive: true,
        entryCount: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("rejects missing priceListId, bad ids, and identifier fields", () => {
    expect(setDefaultPriceListInputSchema.safeParse({}).success).toBe(false);
    expect(
      setDefaultPriceListInputSchema.safeParse({
        priceListId: "not-a-uuid",
      }).success,
    ).toBe(false);
    expect(
      setDefaultPriceListInputSchema.safeParse({
        priceListId: validId,
        companyId: "c",
      }).success,
    ).toBe(false);
    expect(
      setDefaultPriceListInputSchema.safeParse({
        priceListId: validId,
        id: validId,
      }).success,
    ).toBe(false);
    expect(
      setDefaultPriceListInputSchema.safeParse({
        priceListId: validId,
        isActive: false,
      }).success,
    ).toBe(false);
  });
});
