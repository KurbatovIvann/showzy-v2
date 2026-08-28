import { describe, expect, it } from "vitest";

import {
  deleteGroupContract,
  deleteGroupInputSchema,
  deleteGroupOutputSchema,
} from "./delete-group.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

describe("customers.deleteGroup contract", () => {
  it("is an idempotent audited high-risk staff client write with confirmation and customers:edit", () => {
    expect(deleteGroupContract.name).toBe("customers.deleteGroup");
    expect(deleteGroupContract.principal).toBe("staff");
    expect(deleteGroupContract.transport).toBe("client");
    expect(deleteGroupContract.risk).toBe("high");
    expect(deleteGroupContract.permissions).toEqual(["customers:edit"]);
    expect(deleteGroupContract.aiExposure).toBe("exposed");
    expect(deleteGroupContract.requiresConfirmation).toBe(true);
    expect(deleteGroupContract.idempotent).toBe(true);
    expect(deleteGroupContract.audit).toBe(true);
    expect(deleteGroupContract.emits).toEqual([]);
    expect(deleteGroupContract.atomicCalls).toEqual([]);
    expect(deleteGroupContract.atomicCallers).toEqual([]);
    expect(deleteGroupContract.timeout).toBe(5_000);
    expect(deleteGroupContract.rateLimit).toBeUndefined();
    expect(Object.keys(deleteGroupOutputSchema.shape).toSorted()).toEqual([
      "id",
    ]);
  });

  it("accepts a uuid id and rejects missing, malformed, and extra identifier fields", () => {
    expect(deleteGroupInputSchema.parse({ id: validId })).toEqual({
      id: validId,
    });
    expect(deleteGroupInputSchema.safeParse({}).success).toBe(false);
    expect(deleteGroupInputSchema.safeParse({ id: "not-a-uuid" }).success).toBe(
      false,
    );
    for (const extra of [
      { companyId: "c" },
      { name: "VIP" },
      { slug: "vip" },
      { memberCount: 1 },
    ]) {
      expect(
        deleteGroupInputSchema.safeParse({ id: validId, ...extra }).success,
      ).toBe(false);
    }
  });
});
