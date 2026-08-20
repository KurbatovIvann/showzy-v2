import { describe, expect, it } from "vitest";

import {
  computeExemptNoneLine,
  roundHalfAwayFromZero,
  titleSnapshot,
} from "./line-money.js";

describe("roundHalfAwayFromZero", () => {
  it.each([
    { numerator: 100n, denominator: 1000n, expected: 0n },
    { numerator: 499n, denominator: 1000n, expected: 0n },
    { numerator: 500n, denominator: 1000n, expected: 1n },
    { numerator: 501n, denominator: 1000n, expected: 1n },
    { numerator: 1500n, denominator: 1000n, expected: 2n },
    { numerator: 2500n, denominator: 1000n, expected: 3n },
    { numerator: -500n, denominator: 1000n, expected: -1n },
    { numerator: -499n, denominator: 1000n, expected: 0n },
  ])(
    "$numerator / $denominator → $expected",
    ({ numerator, denominator, expected }) => {
      expect(roundHalfAwayFromZero(numerator, denominator)).toBe(expected);
    },
  );
});

describe("computeExemptNoneLine", () => {
  it.each([
    {
      unit: 100n,
      qty: 1000n,
      net: 100n,
      label: "whole unit",
    },
    {
      unit: 100n,
      qty: 500n,
      net: 50n,
      label: "half unit exact",
    },
    {
      unit: 1n,
      qty: 500n,
      net: 1n,
      label: "0.5 kopiyka rounds away from zero",
    },
    {
      unit: 1n,
      qty: 499n,
      net: 0n,
      label: "just below half",
    },
    {
      unit: 1n,
      qty: 501n,
      net: 1n,
      label: "just above half",
    },
    {
      unit: 3n,
      qty: 500n,
      net: 2n,
      label: "1.5 rounds away from zero",
    },
    {
      unit: 5n,
      qty: 100n,
      net: 1n,
      label: "0.5 via 5 * 100 / 1000",
    },
    {
      unit: 15n,
      qty: 100n,
      net: 2n,
      label: "1.5 via 15 * 100 / 1000",
    },
    {
      unit: 25n,
      qty: 100n,
      net: 3n,
      label: "2.5 via 25 * 100 / 1000",
    },
    {
      unit: 0n,
      qty: 1000n,
      net: 0n,
      label: "zero price",
    },
    {
      unit: 999999n,
      qty: 1000n,
      net: 999999n,
      label: "large whole unit",
    },
  ])("$label", ({ unit, qty, net }) => {
    const line = computeExemptNoneLine(unit, qty);
    expect(line).toEqual({
      discountKind: "none",
      discountValue: 0n,
      discountAmountMinor: 0n,
      taxTreatment: "exempt",
      taxRateBp: 0,
      taxAmountMinor: 0n,
      netAmountMinor: net,
      grossAmountMinor: net,
    });
    expect(line.netAmountMinor + line.taxAmountMinor).toBe(
      line.grossAmountMinor,
    );
  });
});

describe("titleSnapshot", () => {
  it("uses the product name when no variant is named", () => {
    expect(titleSnapshot("Widget", undefined)).toBe("Widget");
  });

  it("joins product and variant with a middle dot", () => {
    expect(titleSnapshot("Widget", "Large")).toBe("Widget · Large");
  });
});
