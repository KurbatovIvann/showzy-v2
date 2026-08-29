import { describe, expect, it } from "vitest";

import { contractModules } from "@showzy/contract";

import {
  COMPANY_LEGAL_ADDRESS_MAX,
  COMPANY_LEGAL_BANK_EDRPOU_MAX,
  COMPANY_LEGAL_BANK_MFO_MAX,
  COMPANY_LEGAL_BANK_NAME_MAX,
  COMPANY_LEGAL_EDRPOU_MAX,
  COMPANY_LEGAL_EMAIL_MAX,
  COMPANY_LEGAL_IBAN_MAX,
  COMPANY_LEGAL_NAME_MAX,
  COMPANY_LEGAL_PHONE_MAX,
} from "./company-caps";

const schema = contractModules.companies.updateLegal.input;

function validWire(overrides: Record<string, unknown> = {}) {
  return {
    companyType: "fop" as const,
    legalName: "ФОП Іваненко",
    edrpou: null,
    legalAddress: null,
    iban: null,
    bankName: null,
    bankMfo: null,
    bankEdrpou: null,
    phone: null,
    email: null,
    ...overrides,
  };
}

describe("company legal caps vs companies.updateLegal", () => {
  it("accepts max-length fields that the wire schema accepts", () => {
    expect(
      schema.safeParse(
        validWire({ legalName: "x".repeat(COMPANY_LEGAL_NAME_MAX) }),
      ).success,
    ).toBe(true);
    expect(
      schema.safeParse(
        validWire({ edrpou: "1".repeat(COMPANY_LEGAL_EDRPOU_MAX) }),
      ).success,
    ).toBe(true);
    expect(
      schema.safeParse(
        validWire({
          legalAddress: "a".repeat(COMPANY_LEGAL_ADDRESS_MAX),
        }),
      ).success,
    ).toBe(true);
    expect(
      schema.safeParse(validWire({ iban: "U".repeat(COMPANY_LEGAL_IBAN_MAX) }))
        .success,
    ).toBe(true);
    expect(
      schema.safeParse(
        validWire({ bankName: "b".repeat(COMPANY_LEGAL_BANK_NAME_MAX) }),
      ).success,
    ).toBe(true);
    expect(
      schema.safeParse(
        validWire({ bankMfo: "3".repeat(COMPANY_LEGAL_BANK_MFO_MAX) }),
      ).success,
    ).toBe(true);
    expect(
      schema.safeParse(
        validWire({
          bankEdrpou: "4".repeat(COMPANY_LEGAL_BANK_EDRPOU_MAX),
        }),
      ).success,
    ).toBe(true);
    expect(
      schema.safeParse(
        validWire({ phone: "5".repeat(COMPANY_LEGAL_PHONE_MAX) }),
      ).success,
    ).toBe(true);
    expect(
      schema.safeParse(
        validWire({ email: "e".repeat(COMPANY_LEGAL_EMAIL_MAX) }),
      ).success,
    ).toBe(true);
  });

  it("rejects one character over each mobile cap on the wire schema", () => {
    expect(
      schema.safeParse(
        validWire({ legalName: "x".repeat(COMPANY_LEGAL_NAME_MAX + 1) }),
      ).success,
    ).toBe(false);
    expect(
      schema.safeParse(
        validWire({ edrpou: "1".repeat(COMPANY_LEGAL_EDRPOU_MAX + 1) }),
      ).success,
    ).toBe(false);
    expect(
      schema.safeParse(
        validWire({
          legalAddress: "a".repeat(COMPANY_LEGAL_ADDRESS_MAX + 1),
        }),
      ).success,
    ).toBe(false);
    expect(
      schema.safeParse(
        validWire({ iban: "U".repeat(COMPANY_LEGAL_IBAN_MAX + 1) }),
      ).success,
    ).toBe(false);
    expect(
      schema.safeParse(
        validWire({
          bankName: "b".repeat(COMPANY_LEGAL_BANK_NAME_MAX + 1),
        }),
      ).success,
    ).toBe(false);
    expect(
      schema.safeParse(
        validWire({ bankMfo: "3".repeat(COMPANY_LEGAL_BANK_MFO_MAX + 1) }),
      ).success,
    ).toBe(false);
    expect(
      schema.safeParse(
        validWire({
          bankEdrpou: "4".repeat(COMPANY_LEGAL_BANK_EDRPOU_MAX + 1),
        }),
      ).success,
    ).toBe(false);
    expect(
      schema.safeParse(
        validWire({ phone: "5".repeat(COMPANY_LEGAL_PHONE_MAX + 1) }),
      ).success,
    ).toBe(false);
    expect(
      schema.safeParse(
        validWire({ email: "e".repeat(COMPANY_LEGAL_EMAIL_MAX + 1) }),
      ).success,
    ).toBe(false);
  });
});
