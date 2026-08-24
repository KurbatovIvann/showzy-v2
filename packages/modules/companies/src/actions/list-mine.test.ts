import { describe, expect, it } from "vitest";

import { listMineContract, listMineInputSchema } from "./list-mine.contract.js";

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
    expect(listMineContract.rateLimit).toEqual({
      scope: "user",
      limit: 30,
      windowSec: 120,
    });
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
});
