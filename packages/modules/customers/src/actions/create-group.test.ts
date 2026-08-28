import { describe, expect, it } from "vitest";

import {
  GROUP_DESCRIPTION_MAX,
  GROUP_NAME_MAX,
  createGroupContract,
  createGroupInputSchema,
  createGroupOutputSchema,
} from "./create-group.contract.js";

describe("customers.createGroup contract", () => {
  it("is an idempotent audited staff client write with customers:edit and no events", () => {
    expect(createGroupContract.name).toBe("customers.createGroup");
    expect(createGroupContract.principal).toBe("staff");
    expect(createGroupContract.transport).toBe("client");
    expect(createGroupContract.risk).toBe("write");
    expect(createGroupContract.permissions).toEqual(["customers:edit"]);
    expect(createGroupContract.aiExposure).toBe("exposed");
    expect(createGroupContract.requiresConfirmation).toBe(false);
    expect(createGroupContract.idempotent).toBe(true);
    expect(createGroupContract.audit).toBe(true);
    expect(createGroupContract.emits).toEqual([]);
    expect(createGroupContract.atomicCalls).toEqual([]);
    expect(createGroupContract.atomicCallers).toEqual([]);
    expect(createGroupContract.timeout).toBe(5_000);
    expect(createGroupContract.rateLimit).toBeUndefined();
    expect(GROUP_NAME_MAX).toBe(120);
    expect(GROUP_DESCRIPTION_MAX).toBe(2000);
  });

  it("trims the name and defaults omitted optional fields", () => {
    const parsed = createGroupInputSchema.parse({
      name: "  Київські торти  ",
    });
    expect(parsed).toEqual({ name: "Київські торти" });
    expect(Object.keys(createGroupOutputSchema.shape).toSorted()).toEqual([
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

  it("rejects blank names, over-max fields, and malformed price-list ids", () => {
    expect(createGroupInputSchema.safeParse({ name: "   " }).success).toBe(
      false,
    );
    expect(
      createGroupInputSchema.safeParse({
        name: "x".repeat(GROUP_NAME_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      createGroupInputSchema.safeParse({
        name: "VIP",
        description: "x".repeat(GROUP_DESCRIPTION_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      createGroupInputSchema.safeParse({
        name: "VIP",
        priceListId: "not-a-uuid",
      }).success,
    ).toBe(false);
    expect(
      createGroupInputSchema.parse({
        name: "VIP",
        priceListId: null,
      }).priceListId,
    ).toBeNull();
  });

  it("rejects identifier fields — the input is strict and slug is server-only", () => {
    const valid = { name: "VIP" };
    for (const extra of [
      { companyId: "c" },
      { id: "11111111-1111-4111-8111-111111111111" },
      { slug: "vip" },
      { sortOrder: 1 },
      { color: "#fff" },
      { userId: "u" },
    ]) {
      expect(
        createGroupInputSchema.safeParse({ ...valid, ...extra }).success,
      ).toBe(false);
    }
  });
});
