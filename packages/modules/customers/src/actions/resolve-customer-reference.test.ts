import { describe, expect, it } from "vitest";

import { ENTITY_REF_QUERY_MAX } from "@showzy/validation/entity-ref";

import {
  RESOLVE_CUSTOMER_REFERENCE_QUERY_MAX,
  resolveCustomerReferenceContract,
} from "./resolve-customer-reference.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

describe("customers.resolveCustomerReference contract", () => {
  it("is a staff internal read with customers:view", () => {
    expect(resolveCustomerReferenceContract.name).toBe(
      "customers.resolveCustomerReference",
    );
    expect(resolveCustomerReferenceContract.principal).toBe("staff");
    expect(resolveCustomerReferenceContract.transport).toBe("internal");
    expect(resolveCustomerReferenceContract.risk).toBe("read");
    expect(resolveCustomerReferenceContract.permissions).toEqual([
      "customers:view",
    ]);
    expect(resolveCustomerReferenceContract.aiExposure).toBe("internal");
    expect(resolveCustomerReferenceContract.audit).toBe(false);
    expect(resolveCustomerReferenceContract.idempotent).toBe(false);
    expect(resolveCustomerReferenceContract.emits).toEqual([]);
    expect(resolveCustomerReferenceContract.timeout).toBe(5_000);
    expect(RESOLVE_CUSTOMER_REFERENCE_QUERY_MAX).toBe(ENTITY_REF_QUERY_MAX);
    expect(RESOLVE_CUSTOMER_REFERENCE_QUERY_MAX).toBe(100);
  });

  it("accepts id or query and rejects extras, blank query, and companyId", () => {
    expect(
      resolveCustomerReferenceContract.input.parse({ by: "id", id: validId }),
    ).toEqual({ by: "id", id: validId });
    expect(
      resolveCustomerReferenceContract.input.parse({
        by: "query",
        value: "  Alpha  ",
      }),
    ).toEqual({ by: "query", value: "Alpha" });
    expect(resolveCustomerReferenceContract.input.safeParse({}).success).toBe(
      false,
    );
    expect(
      resolveCustomerReferenceContract.input.safeParse({
        by: "query",
        value: "   ",
      }).success,
    ).toBe(false);
    expect(
      resolveCustomerReferenceContract.input.safeParse({
        by: "query",
        value: "x".repeat(101),
      }).success,
    ).toBe(false);
    expect(
      resolveCustomerReferenceContract.input.safeParse({
        by: "id",
        id: validId,
        companyId: validId,
      }).success,
    ).toBe(false);
  });
});
