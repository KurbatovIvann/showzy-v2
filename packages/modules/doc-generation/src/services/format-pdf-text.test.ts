import { describe, expect, it } from "vitest";

import { CoreInvariantError } from "@showzy/core/errors";

import {
  formatIssuedOn,
  formatMoneyUah,
  formatQuantityMilli,
} from "./format-pdf-text.js";

describe("formatIssuedOn", () => {
  it("splits the stored Kyiv calendar day without Date constructors", () => {
    expect(formatIssuedOn("2026-03-15")).toBe("15.03.2026");
    expect(formatIssuedOn("2025-12-31")).toBe("31.12.2025");
    expect(() => formatIssuedOn("15.03.2026")).toThrow(CoreInvariantError);
  });
});

describe("formatMoneyUah / formatQuantityMilli", () => {
  it("formats minor units and milli quantities with a decimal comma", () => {
    expect(formatMoneyUah("250")).toBe("2,50 грн");
    expect(formatMoneyUah("100000")).toBe("1 000,00 грн");
    expect(formatQuantityMilli("1000")).toBe("1");
    expect(formatQuantityMilli("1500")).toBe("1,5");
    expect(formatQuantityMilli("1000000")).toBe("1 000");
  });
});
