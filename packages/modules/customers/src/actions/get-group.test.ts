import { describe, expect, it } from "vitest";

import {
  getGroupContract,
  getGroupInputSchema,
  getGroupOutputSchema,
} from "./get-group.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

describe("customers.getGroup contract", () => {
  it("is a staff client read with customers:view", () => {
    expect(getGroupContract.name).toBe("customers.getGroup");
    expect(getGroupContract.principal).toBe("staff");
    expect(getGroupContract.transport).toBe("client");
    expect(getGroupContract.risk).toBe("read");
    expect(getGroupContract.permissions).toEqual(["customers:view"]);
    expect(getGroupContract.aiExposure).toBe("exposed");
    expect(getGroupContract.audit).toBe(false);
    expect(getGroupContract.idempotent).toBe(false);
    expect(getGroupContract.emits).toEqual([]);
    expect(getGroupContract.timeout).toBe(5_000);
    expect(getGroupContract.rateLimit).toBeUndefined();
    expect(Object.keys(getGroupOutputSchema.shape).toSorted()).toEqual([
      "createdAt",
      "description",
      "id",
      "memberCount",
      "name",
      "priceListId",
      "slug",
      "updatedAt",
    ]);
  });

  it("accepts a uuid id and rejects missing, malformed, and extra identifier fields", () => {
    expect(getGroupInputSchema.parse({ id: validId })).toEqual({
      id: validId,
    });
    expect(getGroupInputSchema.safeParse({}).success).toBe(false);
    expect(getGroupInputSchema.safeParse({ id: "not-a-uuid" }).success).toBe(
      false,
    );
    for (const extra of [
      { companyId: "c" },
      { slug: "vip" },
      { name: "VIP" },
      { memberCount: 1 },
    ]) {
      expect(
        getGroupInputSchema.safeParse({ id: validId, ...extra }).success,
      ).toBe(false);
    }
  });
});
