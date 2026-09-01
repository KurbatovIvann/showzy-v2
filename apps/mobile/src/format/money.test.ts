import { describe, expect, it } from "vitest";

import { formatMoneyMinor, groupDigits } from "./money";

const NBSP = "\u00A0";

describe("formatMoneyMinor", () => {
  it("formats UAH minor units with grouped digits and the hryvnia sign", () => {
    expect(formatMoneyMinor("123456", "UAH")).toBe(`1${NBSP}234,56${NBSP}₴`);
    expect(formatMoneyMinor("500000", "UAH")).toBe(`5${NBSP}000${NBSP}₴`);
    expect(formatMoneyMinor("1234567890", "UAH")).toBe(
      `12${NBSP}345${NBSP}678,90${NBSP}₴`,
    );
  });

  it("omits zero kopiykas and keeps sub-hryvnia amounts two-digit", () => {
    expect(formatMoneyMinor("0", "UAH")).toBe(`0${NBSP}₴`);
    expect(formatMoneyMinor("5", "UAH")).toBe(`0,05${NBSP}₴`);
    expect(formatMoneyMinor("100", "UAH")).toBe(`1${NBSP}₴`);
  });

  it("formats negative amounts with a minus sign", () => {
    expect(formatMoneyMinor("-123456", "UAH")).toBe(`−1${NBSP}234,56${NBSP}₴`);
  });

  it("survives values beyond Number.MAX_SAFE_INTEGER", () => {
    expect(formatMoneyMinor("9223372036854775807", "UAH")).toBe(
      `92${NBSP}233${NBSP}720${NBSP}368${NBSP}547${NBSP}758,07${NBSP}₴`,
    );
  });

  it("falls back to the ISO code for a non-UAH currency", () => {
    expect(formatMoneyMinor("150", "USD")).toBe(`1,50${NBSP}USD`);
  });

  it("rejects a non-canonical wire value", () => {
    expect(() => formatMoneyMinor("01", "UAH")).toThrow();
    expect(() => formatMoneyMinor("1.5", "UAH")).toThrow();
  });
});

describe("groupDigits", () => {
  it("inserts no-break spaces from the right for shared quantity/money grouping", () => {
    expect(groupDigits("1")).toBe("1");
    expect(groupDigits("1234")).toBe(`1${NBSP}234`);
    expect(groupDigits("1234567")).toBe(`1${NBSP}234${NBSP}567`);
  });
});
