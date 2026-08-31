import { describe, expect, it } from "vitest";

import { INT64_MAX, INT64_MIN } from "@showzy/validation/money";

import { moneyWireSchema } from "./wire.contract.js";

describe("orders money wire (SHO-284)", () => {
  it("rejects amounts outside signed int64 as Zod failure, not a bigint overflow", () => {
    expect(moneyWireSchema.safeParse(INT64_MAX.toString(10)).success).toBe(
      true,
    );
    expect(moneyWireSchema.safeParse(INT64_MIN.toString(10)).success).toBe(
      true,
    );
    expect(
      moneyWireSchema.safeParse((INT64_MAX + 1n).toString(10)).success,
    ).toBe(false);
    expect(moneyWireSchema.safeParse("9223372036854775808").success).toBe(
      false,
    );
    expect(moneyWireSchema.safeParse("-9223372036854775809").success).toBe(
      false,
    );
  });
});
