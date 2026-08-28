import { describe, expect, it } from "vitest";

import {
  deactivatePriceListContract,
  deactivatePriceListInputSchema,
  deactivatePriceListOutputSchema,
} from "./deactivate-price-list.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

describe("pricing.deactivatePriceList contract", () => {
  it("is an idempotent audited staff client write with pricing:manage and no events", () => {
    expect(deactivatePriceListContract.name).toBe(
      "pricing.deactivatePriceList",
    );
    expect(deactivatePriceListContract.principal).toBe("staff");
    expect(deactivatePriceListContract.transport).toBe("client");
    expect(deactivatePriceListContract.risk).toBe("write");
    expect(deactivatePriceListContract.permissions).toEqual(["pricing:manage"]);
    expect(deactivatePriceListContract.aiExposure).toBe("exposed");
    expect(deactivatePriceListContract.requiresConfirmation).toBe(false);
    expect(deactivatePriceListContract.idempotent).toBe(true);
    expect(deactivatePriceListContract.audit).toBe(true);
    expect(deactivatePriceListContract.emits).toEqual([]);
    expect(deactivatePriceListContract.atomicCalls).toEqual([]);
    expect(deactivatePriceListContract.atomicCallers).toEqual([]);
    expect(deactivatePriceListContract.timeout).toBe(5_000);
    expect(deactivatePriceListContract.rateLimit).toBeUndefined();
    expect(
      Object.keys(deactivatePriceListOutputSchema.shape).toSorted(),
    ).toEqual([
      "createdAt",
      "entryCount",
      "id",
      "isActive",
      "isDefault",
      "name",
      "updatedAt",
    ]);
  });

  it("accepts { id } and rejects identifier fields and status flags", () => {
    expect(deactivatePriceListInputSchema.parse({ id: validId })).toEqual({
      id: validId,
    });
    expect(
      deactivatePriceListInputSchema.safeParse({ id: "not-a-uuid" }).success,
    ).toBe(false);
    for (const extra of [
      { companyId: "c" },
      { priceListId: validId },
      { isActive: false },
      { isDefault: false },
    ]) {
      expect(
        deactivatePriceListInputSchema.safeParse({ id: validId, ...extra })
          .success,
      ).toBe(false);
    }
  });
});
