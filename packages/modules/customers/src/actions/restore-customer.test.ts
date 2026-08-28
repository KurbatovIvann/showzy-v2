import { describe, expect, it } from "vitest";

import { customerViewSchema } from "./customer-view.contract.js";
import {
  restoreCustomerContract,
  restoreCustomerInputSchema,
} from "./restore-customer.contract.js";

describe("customers.restoreCustomer contract", () => {
  it("is a staff client write with customers:edit, idempotent audit, and no events", () => {
    expect(restoreCustomerContract.name).toBe("customers.restoreCustomer");
    expect(restoreCustomerContract.principal).toBe("staff");
    expect(restoreCustomerContract.transport).toBe("client");
    expect(restoreCustomerContract.risk).toBe("write");
    expect(restoreCustomerContract.permissions).toEqual(["customers:edit"]);
    expect(restoreCustomerContract.aiExposure).toBe("exposed");
    expect(restoreCustomerContract.audit).toBe(true);
    expect(restoreCustomerContract.idempotent).toBe(true);
    expect(restoreCustomerContract.requiresConfirmation).toBe(false);
    expect(restoreCustomerContract.emits).toEqual([]);
    expect(restoreCustomerContract.atomicCalls).toEqual([]);
    expect(restoreCustomerContract.atomicCallers).toEqual([]);
    expect(restoreCustomerContract.timeout).toBe(5_000);
    expect(restoreCustomerContract.rateLimit).toBeUndefined();
    expect(restoreCustomerContract.description).toContain("status-only");
    expect(Object.keys(customerViewSchema.shape).toSorted()).toEqual([
      "createdAt",
      "email",
      "groupId",
      "id",
      "linkedCounterpartyCount",
      "name",
      "notes",
      "phone",
      "priceListId",
      "status",
      "updatedAt",
      "userId",
    ]);
  });

  it("accepts a uuid id and rejects missing, malformed, and extra fields", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(restoreCustomerInputSchema.parse({ id })).toEqual({ id });
    expect(restoreCustomerInputSchema.safeParse({}).success).toBe(false);
    expect(
      restoreCustomerInputSchema.safeParse({ id: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      restoreCustomerInputSchema.safeParse({
        id,
        companyId: "c",
      }).success,
    ).toBe(false);
    expect(
      restoreCustomerInputSchema.safeParse({
        id,
        status: "active",
      }).success,
    ).toBe(false);
  });
});
