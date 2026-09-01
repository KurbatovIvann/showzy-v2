import { describe, expect, it } from "vitest";

import {
  INT64_MAX,
  INT64_MIN,
  decimalQuantityToMilli,
  isDecimalQuantityString,
  isMoneyWire,
  moneyWireSchema,
  nonNegativeMoneyWireSchema,
  quantityMilliWireSchema,
} from "./money.js";

describe("@showzy/validation/money", () => {
  it("accepts canonical signed int64 strings without becoming bigint", () => {
    for (const value of [
      "0",
      "1",
      "-1",
      "199",
      INT64_MIN.toString(10),
      INT64_MAX.toString(10),
    ]) {
      expect(isMoneyWire(value)).toBe(true);
      const parsed = moneyWireSchema.parse(value);
      expect(parsed).toBe(value);
      expect(typeof parsed).toBe("string");
    }
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
      (INT64_MAX + 1n).toString(10),
      (INT64_MIN - 1n).toString(10),
      "9223372036854775808",
      "-9223372036854775809",
    ];
    for (const value of invalid) {
      expect(isMoneyWire(value)).toBe(false);
      expect(moneyWireSchema.safeParse(value).success).toBe(false);
    }
  });

  it("rejects negative prices on the non-negative refine", () => {
    expect(nonNegativeMoneyWireSchema.parse("0")).toBe("0");
    expect(nonNegativeMoneyWireSchema.parse("100")).toBe("100");
    expect(nonNegativeMoneyWireSchema.safeParse("-1").success).toBe(false);
  });

  it("accepts canonical positive quantity milli strings", () => {
    expect(quantityMilliWireSchema.parse("1")).toBe("1");
    expect(quantityMilliWireSchema.parse("1000")).toBe("1000");
    expect(quantityMilliWireSchema.safeParse("0").success).toBe(false);
    expect(quantityMilliWireSchema.safeParse("01").success).toBe(false);
    expect(quantityMilliWireSchema.safeParse("-1").success).toBe(false);
  });

  it("converts decimal quantity strings at milli scale 3", () => {
    expect(isDecimalQuantityString("1.5")).toBe(true);
    expect(isDecimalQuantityString("1.2345")).toBe(false);
    expect(decimalQuantityToMilli("1.5")).toBe(1500n);
    expect(decimalQuantityToMilli("1")).toBe(1000n);
    expect(decimalQuantityToMilli("0.001")).toBe(1n);
    expect(decimalQuantityToMilli("0")).toBeUndefined();
    expect(decimalQuantityToMilli("0.000")).toBeUndefined();
  });
});
