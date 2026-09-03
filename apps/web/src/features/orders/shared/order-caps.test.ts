import { describe, expect, it } from "vitest";

import { LIST_CUSTOMERS_SEARCH_MAX } from "@showzy/validation/customers";
import { LIST_PRODUCTS_QUERY_MAX } from "@showzy/validation/catalog";

import {
  LIST_CUSTOMERS_SEARCH_MAX as ORDER_CUSTOMERS_SEARCH_MAX,
  LIST_PRODUCTS_QUERY_MAX as ORDER_PRODUCTS_QUERY_MAX,
  ORDER_LOOKUP_PAGE_SIZE,
  ORDER_LOOKUP_SEARCH_DEBOUNCE_MS,
  normalizeOrderLookupSearch,
} from "./order-caps";

describe("order lookup caps (SHO-379)", () => {
  it("keeps picker search in lockstep with the contract list inputs", () => {
    expect(ORDER_LOOKUP_PAGE_SIZE).toBe(50);
    expect(ORDER_LOOKUP_SEARCH_DEBOUNCE_MS).toBe(300);
    expect(ORDER_CUSTOMERS_SEARCH_MAX).toBe(LIST_CUSTOMERS_SEARCH_MAX);
    expect(ORDER_PRODUCTS_QUERY_MAX).toBe(LIST_PRODUCTS_QUERY_MAX);
    expect(normalizeOrderLookupSearch("  Зоя  ", 100)).toBe("Зоя");
    expect(normalizeOrderLookupSearch("   ", 100)).toBeUndefined();
    expect(normalizeOrderLookupSearch("a".repeat(120), 100)).toHaveLength(100);
  });
});
