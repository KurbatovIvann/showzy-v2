import { describe, expect, it } from "vitest";

import {
  CUSTOMER_EMAIL_MAX,
  CUSTOMER_NAME_MAX,
  CUSTOMER_NOTES_MAX,
  CUSTOMER_PHONE_MAX,
  GROUP_DESCRIPTION_MAX,
  GROUP_NAME_MAX,
  LIST_COUNTERPARTIES_SEARCH_MAX,
  LIST_CUSTOMERS_SEARCH_MAX,
  LIST_GROUPS_SEARCH_MAX,
} from "./customers.js";

describe("@showzy/validation/customers", () => {
  it("exports the list search caps the feature card named", () => {
    expect(LIST_CUSTOMERS_SEARCH_MAX).toBe(100);
    expect(LIST_GROUPS_SEARCH_MAX).toBe(100);
    expect(LIST_COUNTERPARTIES_SEARCH_MAX).toBe(100);
  });

  it("exports the customer form caps the feature card named", () => {
    expect(CUSTOMER_NAME_MAX).toBe(120);
    expect(CUSTOMER_PHONE_MAX).toBe(30);
    expect(CUSTOMER_EMAIL_MAX).toBe(200);
    expect(CUSTOMER_NOTES_MAX).toBe(2000);
  });

  it("exports the group form caps the feature card named", () => {
    expect(GROUP_NAME_MAX).toBe(120);
    expect(GROUP_DESCRIPTION_MAX).toBe(2000);
  });
});
