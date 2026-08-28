import { describe, expect, it } from "vitest";

import { PRICE_LIST_NAME_MAX } from "./list-price-lists.contract.js";
import {
  createPriceListContract,
  createPriceListInputSchema,
  createPriceListOutputSchema,
} from "./create-price-list.contract.js";

describe("pricing.createPriceList contract", () => {
  it("is an idempotent audited staff client write with pricing:manage and no events", () => {
    expect(createPriceListContract.name).toBe("pricing.createPriceList");
    expect(createPriceListContract.principal).toBe("staff");
    expect(createPriceListContract.transport).toBe("client");
    expect(createPriceListContract.risk).toBe("write");
    expect(createPriceListContract.permissions).toEqual(["pricing:manage"]);
    expect(createPriceListContract.aiExposure).toBe("exposed");
    expect(createPriceListContract.requiresConfirmation).toBe(false);
    expect(createPriceListContract.idempotent).toBe(true);
    expect(createPriceListContract.audit).toBe(true);
    expect(createPriceListContract.emits).toEqual([]);
    expect(createPriceListContract.atomicCalls).toEqual([]);
    expect(createPriceListContract.atomicCallers).toEqual([]);
    expect(createPriceListContract.timeout).toBe(5_000);
    expect(createPriceListContract.rateLimit).toBeUndefined();
    expect(PRICE_LIST_NAME_MAX).toBe(120);
  });

  it("trims the name and defaults isDefault false and isActive true", () => {
    const parsed = createPriceListInputSchema.parse({
      name: "  Оптовий  ",
    });
    expect(parsed).toEqual({
      name: "Оптовий",
      isDefault: false,
      isActive: true,
    });
    expect(Object.keys(createPriceListOutputSchema.shape).toSorted()).toEqual([
      "createdAt",
      "entryCount",
      "id",
      "isActive",
      "isDefault",
      "name",
      "updatedAt",
    ]);
  });

  it("rejects blank names, over-max names, and identifier fields", () => {
    expect(createPriceListInputSchema.safeParse({ name: "   " }).success).toBe(
      false,
    );
    expect(
      createPriceListInputSchema.safeParse({
        name: "x".repeat(PRICE_LIST_NAME_MAX + 1),
      }).success,
    ).toBe(false);
    const valid = { name: "Wholesale" };
    for (const extra of [
      { companyId: "c" },
      { id: "11111111-1111-4111-8111-111111111111" },
      { userId: "u" },
      { entryCount: 0 },
    ]) {
      expect(
        createPriceListInputSchema.safeParse({ ...valid, ...extra }).success,
      ).toBe(false);
    }
  });
});
