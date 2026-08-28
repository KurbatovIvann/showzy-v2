import { describe, expect, it } from "vitest";

import {
  CUSTOMER_EMAIL_MAX,
  CUSTOMER_FORM_NOTES_LINES,
  CUSTOMER_NAME_MAX,
  CUSTOMER_NOTES_MAX,
  CUSTOMER_PHONE_MAX,
  CUSTOMERS_LOOKUP_PAGE_SIZE,
  LIST_CUSTOMERS_SEARCH_MAX,
  LIST_GROUPS_SEARCH_MAX,
} from "./customer-caps";

describe("customer caps", () => {
  it("re-exports list search max and the drained lookup page size", () => {
    expect(LIST_CUSTOMERS_SEARCH_MAX).toBe(100);
    expect(LIST_GROUPS_SEARCH_MAX).toBe(100);
    expect(CUSTOMERS_LOOKUP_PAGE_SIZE).toBe(50);
    expect(CUSTOMER_FORM_NOTES_LINES).toBe(5);
  });

  it("re-exports the form field caps from validation", () => {
    expect(CUSTOMER_NAME_MAX).toBe(120);
    expect(CUSTOMER_PHONE_MAX).toBe(30);
    expect(CUSTOMER_EMAIL_MAX).toBe(200);
    expect(CUSTOMER_NOTES_MAX).toBe(2000);
  });
});
