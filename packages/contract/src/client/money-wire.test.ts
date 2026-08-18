import { describe, expect, it } from "vitest";

import {
  INT64_MAX,
  INT64_MIN,
  MoneyWireError,
  isMoneyWire,
  moneyFromWire,
  moneyToWire,
  moneyWireSchema,
} from "./money-wire.js";

describe("money wire helpers (contract.md §3, db.md §3)", () => {
  it("round-trips every 64-bit bound without JSON number precision loss", () => {
    for (const minor of [
      0n,
      1n,
      -1n,
      199n,
      INT64_MIN,
      INT64_MAX,
      9007199254740993n, // Number.MAX_SAFE_INTEGER + 2
    ]) {
      const wire = moneyToWire(minor);
      const json = JSON.stringify({ amount: wire });
      const parsed: unknown = JSON.parse(json);
      expect(parsed).toEqual({ amount: wire });
      expect(moneyFromWire(wire)).toBe(minor);
    }

    expect(moneyToWire(INT64_MAX)).toBe("9223372036854775807");
    expect(moneyToWire(INT64_MIN)).toBe("-9223372036854775808");
    // IEEE-754 cannot hold int64 max: the JSON-number form is a different
    // value, which is why the wire type is a string.
    expect(Number(INT64_MAX)).toBe(9223372036854776000);
  });

  it("rejects non-canonical encodings and values outside signed int64", () => {
    const invalid = [
      "",
      "+1",
      "01",
      "-0",
      "1.0",
      "1e3",
      " 1",
      "1 ",
      "0x10",
      "9223372036854775808",
      "-9223372036854775809",
    ];
    for (const value of invalid) {
      expect(isMoneyWire(value)).toBe(false);
      expect(() => moneyFromWire(value)).toThrow(MoneyWireError);
      expect(moneyWireSchema.safeParse(value).success).toBe(false);
    }

    expect(() => moneyToWire(INT64_MAX + 1n)).toThrow(MoneyWireError);
    expect(() => moneyToWire(INT64_MIN - 1n)).toThrow(MoneyWireError);
  });

  it("accepts canonical strings in the Zod schema without becoming bigint", () => {
    const parsed = moneyWireSchema.parse("199");
    expect(parsed).toBe("199");
    expect(typeof parsed).toBe("string");
  });
});
