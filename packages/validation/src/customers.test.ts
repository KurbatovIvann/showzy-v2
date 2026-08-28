import { describe, expect, it } from "vitest";

import {
  LIST_CUSTOMERS_SEARCH_MAX,
  LIST_GROUPS_SEARCH_MAX,
} from "./customers.js";

describe("@showzy/validation/customers", () => {
  it("exports the list search caps the feature card named", () => {
    expect(LIST_CUSTOMERS_SEARCH_MAX).toBe(100);
    expect(LIST_GROUPS_SEARCH_MAX).toBe(100);
  });
});
