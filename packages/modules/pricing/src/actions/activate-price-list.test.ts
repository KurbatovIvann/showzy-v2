import { describe, expect, it } from "vitest";

import {
  activatePriceListContract,
  activatePriceListInputSchema,
  activatePriceListOutputSchema,
} from "./activate-price-list.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

describe("pricing.activatePriceList contract", () => {
  it("is an idempotent audited staff client write with pricing:manage and no events", () => {
    expect(activatePriceListContract.name).toBe("pricing.activatePriceList");
    expect(activatePriceListContract.principal).toBe("staff");
    expect(activatePriceListContract.transport).toBe("client");
    expect(activatePriceListContract.risk).toBe("write");
    expect(activatePriceListContract.permissions).toEqual(["pricing:manage"]);
    expect(activatePriceListContract.aiExposure).toBe("exposed");
    expect(activatePriceListContract.requiresConfirmation).toBe(false);
    expect(activatePriceListContract.idempotent).toBe(true);
    expect(activatePriceListContract.audit).toBe(true);
    expect(activatePriceListContract.emits).toEqual([]);
    expect(activatePriceListContract.atomicCalls).toEqual([]);
    expect(activatePriceListContract.atomicCallers).toEqual([]);
    expect(activatePriceListContract.timeout).toBe(5_000);
    expect(activatePriceListContract.rateLimit).toBeUndefined();
    expect(Object.keys(activatePriceListOutputSchema.shape).toSorted()).toEqual(
      [
        "createdAt",
        "entryCount",
        "id",
        "isActive",
        "isDefault",
        "name",
        "updatedAt",
      ],
    );
  });

  it("accepts { id } and rejects identifier fields and status flags", () => {
    expect(activatePriceListInputSchema.parse({ id: validId })).toEqual({
      id: validId,
    });
    expect(
      activatePriceListInputSchema.safeParse({ id: "not-a-uuid" }).success,
    ).toBe(false);
    for (const extra of [
      { companyId: "c" },
      { priceListId: validId },
      { isActive: true },
      { isDefault: true },
    ]) {
      expect(
        activatePriceListInputSchema.safeParse({ id: validId, ...extra })
          .success,
      ).toBe(false);
    }
  });
});
