import { describe, expect, it } from "vitest";

import {
  getCounterpartyContract,
  getCounterpartyInputSchema,
  getCounterpartyOutputSchema,
} from "./get-counterparty.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

describe("customers.getCounterparty contract", () => {
  it("is a staff client read with customers:view", () => {
    expect(getCounterpartyContract.name).toBe("customers.getCounterparty");
    expect(getCounterpartyContract.principal).toBe("staff");
    expect(getCounterpartyContract.transport).toBe("client");
    expect(getCounterpartyContract.risk).toBe("read");
    expect(getCounterpartyContract.permissions).toEqual(["customers:view"]);
    expect(getCounterpartyContract.aiExposure).toBe("exposed");
    expect(getCounterpartyContract.requiresConfirmation).toBe(false);
    expect(getCounterpartyContract.audit).toBe(false);
    expect(getCounterpartyContract.idempotent).toBe(false);
    expect(getCounterpartyContract.emits).toEqual([]);
    expect(getCounterpartyContract.atomicCalls).toEqual([]);
    expect(getCounterpartyContract.atomicCallers).toEqual([]);
    expect(getCounterpartyContract.timeout).toBe(5_000);
    expect(getCounterpartyContract.rateLimit).toBeUndefined();
    expect(Object.keys(getCounterpartyOutputSchema.shape).toSorted()).toEqual([
      "bankMfo",
      "bankName",
      "createdAt",
      "customerId",
      "customerName",
      "edrpou",
      "email",
      "iban",
      "id",
      "legalAddress",
      "name",
      "notes",
      "phone",
      "updatedAt",
    ]);
  });

  it("accepts a uuid id and rejects missing, malformed, and extra identifier fields", () => {
    expect(getCounterpartyInputSchema.parse({ id: validId })).toEqual({
      id: validId,
    });
    expect(getCounterpartyInputSchema.safeParse({}).success).toBe(false);
    expect(
      getCounterpartyInputSchema.safeParse({ id: "not-a-uuid" }).success,
    ).toBe(false);
    for (const extra of [
      { companyId: "c" },
      { counterpartyId: validId },
      { customerId: validId },
    ]) {
      expect(
        getCounterpartyInputSchema.safeParse({ id: validId, ...extra }).success,
      ).toBe(false);
    }
  });
});
