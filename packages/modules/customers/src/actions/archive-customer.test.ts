import { describe, expect, it } from "vitest";

import { customerViewSchema } from "./customer-view.contract.js";
import {
  archiveCustomerContract,
  archiveCustomerInputSchema,
} from "./archive-customer.contract.js";

describe("customers.archiveCustomer contract", () => {
  it("is a staff client write with customers:edit, idempotent audit, and no events", () => {
    expect(archiveCustomerContract.name).toBe("customers.archiveCustomer");
    expect(archiveCustomerContract.principal).toBe("staff");
    expect(archiveCustomerContract.transport).toBe("client");
    expect(archiveCustomerContract.risk).toBe("write");
    expect(archiveCustomerContract.permissions).toEqual(["customers:edit"]);
    expect(archiveCustomerContract.aiExposure).toBe("exposed");
    expect(archiveCustomerContract.audit).toBe(true);
    expect(archiveCustomerContract.idempotent).toBe(true);
    expect(archiveCustomerContract.requiresConfirmation).toBe(false);
    expect(archiveCustomerContract.emits).toEqual([]);
    expect(archiveCustomerContract.atomicCalls).toEqual([]);
    expect(archiveCustomerContract.atomicCallers).toEqual([]);
    expect(archiveCustomerContract.timeout).toBe(5_000);
    expect(archiveCustomerContract.rateLimit).toBeUndefined();
    expect(archiveCustomerContract.description).toContain("status-only");
    expect(archiveCustomerContract.output).toBe(customerViewSchema);
  });

  it("accepts a uuid id and rejects missing, malformed, and extra fields", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(archiveCustomerInputSchema.parse({ id })).toEqual({ id });
    expect(archiveCustomerInputSchema.safeParse({}).success).toBe(false);
    expect(
      archiveCustomerInputSchema.safeParse({ id: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      archiveCustomerInputSchema.safeParse({
        id,
        companyId: "c",
      }).success,
    ).toBe(false);
    expect(
      archiveCustomerInputSchema.safeParse({
        id,
        status: "archived",
      }).success,
    ).toBe(false);
  });
});
