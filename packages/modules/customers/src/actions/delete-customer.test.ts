import { describe, expect, it } from "vitest";

import {
  deleteCustomerContract,
  deleteCustomerInputSchema,
  deleteCustomerOutputSchema,
} from "./delete-customer.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

describe("customers.deleteCustomer contract", () => {
  it("is an idempotent audited high-risk staff client write with confirmation and customers:delete", () => {
    expect(deleteCustomerContract.name).toBe("customers.deleteCustomer");
    expect(deleteCustomerContract.principal).toBe("staff");
    expect(deleteCustomerContract.transport).toBe("client");
    expect(deleteCustomerContract.risk).toBe("high");
    expect(deleteCustomerContract.permissions).toEqual(["customers:delete"]);
    expect(deleteCustomerContract.aiExposure).toBe("exposed");
    expect(deleteCustomerContract.requiresConfirmation).toBe(true);
    expect(deleteCustomerContract.idempotent).toBe(true);
    expect(deleteCustomerContract.audit).toBe(true);
    expect(deleteCustomerContract.emits).toEqual([]);
    expect(deleteCustomerContract.atomicCalls).toEqual([]);
    expect(deleteCustomerContract.atomicCallers).toEqual([]);
    expect(deleteCustomerContract.timeout).toBe(5_000);
    expect(deleteCustomerContract.rateLimit).toBeUndefined();
    expect(Object.keys(deleteCustomerOutputSchema.shape).toSorted()).toEqual([
      "id",
    ]);
  });

  it("accepts a uuid id and rejects missing, malformed, and extra identifier fields", () => {
    expect(deleteCustomerInputSchema.parse({ id: validId })).toEqual({
      id: validId,
    });
    expect(deleteCustomerInputSchema.safeParse({}).success).toBe(false);
    expect(
      deleteCustomerInputSchema.safeParse({ id: "not-a-uuid" }).success,
    ).toBe(false);
    for (const extra of [
      { companyId: "c" },
      { name: "Ada" },
      { status: "archived" },
      { phone: "+380501000001" },
    ]) {
      expect(
        deleteCustomerInputSchema.safeParse({ id: validId, ...extra }).success,
      ).toBe(false);
    }
  });
});
