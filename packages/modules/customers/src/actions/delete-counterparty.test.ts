import { describe, expect, it } from "vitest";

import {
  deleteCounterpartyContract,
  deleteCounterpartyInputSchema,
  deleteCounterpartyOutputSchema,
} from "./delete-counterparty.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

describe("customers.deleteCounterparty contract", () => {
  it("is an idempotent audited high-risk staff client write with confirmation and customers:edit", () => {
    expect(deleteCounterpartyContract.name).toBe(
      "customers.deleteCounterparty",
    );
    expect(deleteCounterpartyContract.principal).toBe("staff");
    expect(deleteCounterpartyContract.transport).toBe("client");
    expect(deleteCounterpartyContract.risk).toBe("high");
    expect(deleteCounterpartyContract.permissions).toEqual(["customers:edit"]);
    expect(deleteCounterpartyContract.aiExposure).toBe("exposed");
    expect(deleteCounterpartyContract.requiresConfirmation).toBe(true);
    expect(deleteCounterpartyContract.idempotent).toBe(true);
    expect(deleteCounterpartyContract.audit).toBe(true);
    expect(deleteCounterpartyContract.emits).toEqual([]);
    expect(deleteCounterpartyContract.atomicCalls).toEqual([]);
    expect(deleteCounterpartyContract.atomicCallers).toEqual([]);
    expect(deleteCounterpartyContract.timeout).toBe(5_000);
    expect(deleteCounterpartyContract.rateLimit).toBeUndefined();
    expect(
      Object.keys(deleteCounterpartyOutputSchema.shape).toSorted(),
    ).toEqual(["id"]);
  });

  it("accepts a uuid id and rejects missing, malformed, and extra identifier fields", () => {
    expect(deleteCounterpartyInputSchema.parse({ id: validId })).toEqual({
      id: validId,
    });
    expect(deleteCounterpartyInputSchema.safeParse({}).success).toBe(false);
    expect(
      deleteCounterpartyInputSchema.safeParse({ id: "not-a-uuid" }).success,
    ).toBe(false);
    for (const extra of [
      { companyId: "c" },
      { name: "Acme LLC" },
      { edrpou: "12345678" },
      { customerId: validId },
    ]) {
      expect(
        deleteCounterpartyInputSchema.safeParse({ id: validId, ...extra })
          .success,
      ).toBe(false);
    }
  });
});
