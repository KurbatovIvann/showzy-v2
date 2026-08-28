import { describe, expect, it } from "vitest";

import { LIST_CUSTOMERS_SEARCH_MAX } from "@showzy/validation/customers";

import { flattenPages, nameById, normalizeCustomersSearch } from "./paged-list";

describe("normalizeCustomersSearch", () => {
  it("treats empty and whitespace-only input as no search", () => {
    expect(normalizeCustomersSearch("", 100)).toBeUndefined();
    expect(normalizeCustomersSearch("   ", 100)).toBeUndefined();
  });

  it("trims and caps at the validation export, not a local literal", () => {
    expect(
      normalizeCustomersSearch("  марія  ", LIST_CUSTOMERS_SEARCH_MAX),
    ).toBe("марія");
    const long = "a".repeat(LIST_CUSTOMERS_SEARCH_MAX + 20);
    expect(
      normalizeCustomersSearch(long, LIST_CUSTOMERS_SEARCH_MAX),
    ).toHaveLength(LIST_CUSTOMERS_SEARCH_MAX);
  });
});

describe("flattenPages", () => {
  it("concatenates page items in order", () => {
    expect(flattenPages([{ items: ["a"] }, { items: ["b", "c"] }])).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("nameById", () => {
  it("indexes names by id", () => {
    expect(
      nameById([
        { id: "11111111-1111-4111-8111-111111111111", name: "VIP" },
      ]).get("11111111-1111-4111-8111-111111111111"),
    ).toBe("VIP");
  });
});
