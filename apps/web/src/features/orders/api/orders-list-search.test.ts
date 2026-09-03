import { describe, expect, it } from "vitest";

import {
  listOrdersPageInput,
  normalizeOrdersSearch,
  validateOrdersSearch,
} from "./orders-list-search";

describe("validateOrdersSearch", () => {
  it("keeps q and a CHECK status, and drops Усі / invalid server names", () => {
    expect(validateOrdersSearch({ q: "anna", status: "confirmed" })).toEqual({
      q: "anna",
      status: "confirmed",
    });
    expect(validateOrdersSearch({ status: "all" })).toEqual({});
    expect(validateOrdersSearch({ status: "active" })).toEqual({});
    expect(validateOrdersSearch({ status: "completed" })).toEqual({});
    expect(validateOrdersSearch({ q: "" })).toEqual({});
  });
});

describe("listOrdersPageInput", () => {
  it("omits filter.statuses when the chip is Усі", () => {
    expect(listOrdersPageInput(undefined, undefined)).toEqual({
      kind: "page.summary",
    });
    expect(listOrdersPageInput(undefined, "anna")).toEqual({
      kind: "page.summary",
      filter: { query: "anna" },
    });
  });

  it("sends a single CHECK status, never active / all / completed", () => {
    expect(listOrdersPageInput("in_progress", undefined)).toEqual({
      kind: "page.summary",
      filter: { statuses: ["in_progress"] },
    });
    const json = JSON.stringify(listOrdersPageInput("done", "tm"));
    expect(json).not.toContain("active");
    expect(json).not.toContain("all");
    expect(json).not.toContain("completed");
  });
});

describe("normalizeOrdersSearch", () => {
  it("treats whitespace as no search", () => {
    expect(normalizeOrdersSearch("  ")).toBeUndefined();
    expect(normalizeOrdersSearch("  #KL  ")).toBe("#KL");
  });
});
