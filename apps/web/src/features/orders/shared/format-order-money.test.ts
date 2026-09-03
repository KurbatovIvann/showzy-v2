import { describe, expect, it } from "vitest";

import {
  formatOrderMoney,
  formatOrderQuantityMilli,
} from "./format-order-money";

describe("formatOrderMoney", () => {
  it("formats UAH minor units via moneyFromWire, omitting zero kopiykas", () => {
    expect(formatOrderMoney("123456", "UAH")).toBe("1\u00A0234,56\u00A0₴");
    expect(formatOrderMoney("100", "UAH")).toBe("1\u00A0₴");
    expect(formatOrderMoney("0", "UAH")).toBe("0\u00A0₴");
  });

  it("falls back to the ISO code for non-UAH currencies", () => {
    expect(formatOrderMoney("2500", "EUR")).toBe("25\u00A0EUR");
  });
});

describe("formatOrderQuantityMilli", () => {
  it("formats milli units without trailing zeros", () => {
    expect(formatOrderQuantityMilli("1000")).toBe("1");
    expect(formatOrderQuantityMilli("1500")).toBe("1,5");
    expect(formatOrderQuantityMilli("3000")).toBe("3");
  });
});
