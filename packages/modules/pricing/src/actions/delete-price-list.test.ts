import { describe, expect, it } from "vitest";

import {
  deletePriceListContract,
  deletePriceListInputSchema,
  deletePriceListOutputSchema,
} from "./delete-price-list.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

describe("pricing.deletePriceList contract", () => {
  it("is an idempotent audited high-risk staff client write with confirmation and pricing:manage", () => {
    expect(deletePriceListContract.name).toBe("pricing.deletePriceList");
    expect(deletePriceListContract.principal).toBe("staff");
    expect(deletePriceListContract.transport).toBe("client");
    expect(deletePriceListContract.risk).toBe("high");
    expect(deletePriceListContract.permissions).toEqual(["pricing:manage"]);
    expect(deletePriceListContract.aiExposure).toBe("exposed");
    expect(deletePriceListContract.requiresConfirmation).toBe(true);
    expect(deletePriceListContract.idempotent).toBe(true);
    expect(deletePriceListContract.audit).toBe(true);
    expect(deletePriceListContract.emits).toEqual([]);
    expect(deletePriceListContract.atomicCalls).toEqual([]);
    expect(deletePriceListContract.atomicCallers).toEqual([]);
    expect(deletePriceListContract.timeout).toBe(5_000);
    expect(deletePriceListContract.rateLimit).toBeUndefined();
    expect(Object.keys(deletePriceListOutputSchema.shape).toSorted()).toEqual([
      "id",
    ]);
  });

  it("accepts a uuid id and rejects missing, malformed, and extra identifier fields", () => {
    expect(deletePriceListInputSchema.parse({ id: validId })).toEqual({
      id: validId,
    });
    expect(deletePriceListInputSchema.safeParse({}).success).toBe(false);
    expect(
      deletePriceListInputSchema.safeParse({ id: "not-a-uuid" }).success,
    ).toBe(false);
    for (const extra of [
      { companyId: "c" },
      { name: "Wholesale" },
      { isDefault: true },
      { isActive: false },
    ]) {
      expect(
        deletePriceListInputSchema.safeParse({ id: validId, ...extra }).success,
      ).toBe(false);
    }
  });
});
