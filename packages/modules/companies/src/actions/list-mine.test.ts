import { describe, expect, it } from "vitest";

import { listMineContract, listMineInputSchema, listMineOutputSchema } from "./list-mine.contract.js";

describe("companies.listMine contract", () => {
  it("is an account client read with no permissions, audit, events, or confirmation", () => {
    expect(listMineContract.name).toBe("companies.listMine");
    expect(listMineContract.principal).toBe("account");
    expect(listMineContract.transport).toBe("client");
    expect(listMineContract.risk).toBe("read");
    expect(listMineContract.permissions).toEqual([]);
    expect(listMineContract.aiExposure).toBe("exposed");
    expect(listMineContract.requiresConfirmation).toBe(false);
    expect(listMineContract.idempotent).toBe(false);
    expect(listMineContract.audit).toBe(false);
    expect(listMineContract.emits).toEqual([]);
    expect(listMineContract.atomicCalls).toEqual([]);
    expect(listMineContract.atomicCallers).toEqual([]);
    expect(listMineContract.timeout).toBe(5_000);
    expect(listMineContract.rateLimit).toBeUndefined();
  });

  it("accepts only a strict empty object — identifiers are never input", () => {
    expect(listMineInputSchema.safeParse({}).success).toBe(true);
    expect(listMineInputSchema.safeParse({ userId: "u" }).success).toBe(false);
    expect(listMineInputSchema.safeParse({ companyId: "c" }).success).toBe(
      false,
    );
    expect(listMineInputSchema.safeParse({ membershipId: "m" }).success).toBe(
      false,
    );
    expect(listMineInputSchema.safeParse([]).success).toBe(false);
    expect(listMineInputSchema.safeParse(null).success).toBe(false);
  });

  it("requires additive effective permissions on each membership and ignores client-supplied input authority", () => {
    const company = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Cafe",
      slug: "cafe",
      prefix: "CA",
    };
    const withoutPermissions = {
      membershipId: "22222222-2222-4222-8222-222222222222",
      role: "manager" as const,
      company,
    };
    expect(
      listMineOutputSchema.safeParse({
        memberships: [withoutPermissions],
      }).success,
    ).toBe(false);
    const parsed = listMineOutputSchema.safeParse({
      memberships: [
        {
          ...withoutPermissions,
          permissions: ["orders:edit", "orders:create"],
        },
      ],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data.memberships[0]?.permissions).toEqual([
      "orders:edit",
      "orders:create",
    ]);
    expect(
      listMineInputSchema.safeParse({ permissions: ["orders:create"] })
        .success,
    ).toBe(false);
  });
});
