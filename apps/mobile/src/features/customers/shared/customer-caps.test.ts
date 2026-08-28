import { describe, expect, it } from "vitest";

import {
  CUSTOMERS_LOOKUP_PAGE_SIZE,
  LIST_CUSTOMERS_SEARCH_MAX,
  LIST_GROUPS_SEARCH_MAX,
} from "./customer-caps";

describe("customer caps", () => {
  it("re-exports list search max and the drained lookup page size", () => {
    expect(LIST_CUSTOMERS_SEARCH_MAX).toBe(100);
    expect(LIST_GROUPS_SEARCH_MAX).toBe(100);
    expect(CUSTOMERS_LOOKUP_PAGE_SIZE).toBe(50);
  });
});
