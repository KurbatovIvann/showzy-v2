import { describe, expect, it } from "vitest";

import {
  formatMajorUnitsFromMinor,
  majorUnitsToWire,
  parseMajorUnitsToMinor,
} from "./money-input";

describe("parseMajorUnitsToMinor", () => {
  it("parses comma and dot decimals with grouping spaces into bigint kopiykas", () => {
    expect(parseMajorUnitsToMinor("1234,56")).toEqual({
      ok: true,
      minor: 123456n,
    });
    expect(parseMajorUnitsToMinor("1 234.56")).toEqual({
      ok: true,
      minor: 123456n,
    });
    expect(parseMajorUnitsToMinor("1\u00A0234,56")).toEqual({
      ok: true,
      minor: 123456n,
    });
    expect(parseMajorUnitsToMinor("12,")).toEqual({ ok: true, minor: 1200n });
    expect(parseMajorUnitsToMinor("12,5")).toEqual({ ok: true, minor: 1250n });
    expect(parseMajorUnitsToMinor(",05")).toEqual({ ok: true, minor: 5n });
    expect(parseMajorUnitsToMinor("0")).toEqual({ ok: true, minor: 0n });
  });

  it("does not use binary floats for values beyond Number.MAX_SAFE_INTEGER", () => {
    const parsed = parseMajorUnitsToMinor("92233720368547758,07");
    expect(parsed).toEqual({ ok: true, minor: 9223372036854775807n });
  });

  it("rejects empty, negative, extra decimals, and overflow", () => {
    expect(parseMajorUnitsToMinor("  ")).toEqual({
      ok: false,
      error: "empty",
    });
    expect(parseMajorUnitsToMinor("-1")).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(parseMajorUnitsToMinor("1,234")).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(parseMajorUnitsToMinor("12,3.4")).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(parseMajorUnitsToMinor("abc")).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(parseMajorUnitsToMinor("92233720368547758,08")).toEqual({
      ok: false,
      error: "invalid",
    });
  });
});

describe("formatMajorUnitsFromMinor", () => {
  it("prefills without grouping and omits zero kopiykas", () => {
    expect(formatMajorUnitsFromMinor("123456")).toBe("1234,56");
    expect(formatMajorUnitsFromMinor("100")).toBe("1");
    expect(formatMajorUnitsFromMinor("5")).toBe("0,05");
    expect(formatMajorUnitsFromMinor("0")).toBe("0");
  });
});

describe("majorUnitsToWire", () => {
  it("emits a canonical int64 wire string at the action boundary", () => {
    expect(majorUnitsToWire("1 234,56")).toEqual({
      ok: true,
      minor: 123456n,
      wire: "123456",
    });
    expect(majorUnitsToWire("")).toEqual({ ok: false, error: "empty" });
  });
});
