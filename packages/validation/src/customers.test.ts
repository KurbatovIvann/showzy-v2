import { describe, expect, it } from "vitest";

import {
  COUNTERPARTY_BANK_MFO_MAX,
  COUNTERPARTY_BANK_NAME_MAX,
  COUNTERPARTY_EDRPOU_MAX,
  COUNTERPARTY_EMAIL_MAX,
  COUNTERPARTY_IBAN_MAX,
  COUNTERPARTY_LEGAL_ADDRESS_MAX,
  COUNTERPARTY_NAME_MAX,
  COUNTERPARTY_NOTES_MAX,
  COUNTERPARTY_PHONE_MAX,
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

  it("exports the counterparty form caps the feature card named", () => {
    expect(COUNTERPARTY_NAME_MAX).toBe(300);
    expect(COUNTERPARTY_EDRPOU_MAX).toBe(10);
    expect(COUNTERPARTY_LEGAL_ADDRESS_MAX).toBe(500);
    expect(COUNTERPARTY_IBAN_MAX).toBe(34);
    expect(COUNTERPARTY_BANK_NAME_MAX).toBe(200);
    expect(COUNTERPARTY_BANK_MFO_MAX).toBe(6);
    expect(COUNTERPARTY_PHONE_MAX).toBe(30);
    expect(COUNTERPARTY_EMAIL_MAX).toBe(200);
    expect(COUNTERPARTY_NOTES_MAX).toBe(2000);
  });
});
