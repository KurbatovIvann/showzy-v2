import { describe, expect, it } from "vitest";

import { companiesCopy } from "../../../i18n/companies";
import { resolveCompanyLegalFormCopy } from "./company-legal-form-copy";
import {
  emptyCompanyLegalFormDraft,
  parseCompanyLegalFormUiDraft,
  validateCompanyLegalForm,
} from "./company-legal-form-draft";
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
  companyLegalFormDraftSchema,
  companyLegalFormResolver,
  fieldErrorsFromDraftSchema,
  isNameErrorKey,
} from "./company-legal-form.schema";

const copy = companiesCopy("uk").legalForm;

function validDraft() {
  return {
    ...emptyCompanyLegalFormDraft(),
    legalName: "ФОП Іваненко",
  };
}

describe("companyLegalFormDraftSchema", () => {
  it("requires a legal name and accepts blank optional requisites", () => {
    const parsed = companyLegalFormDraftSchema.safeParse(
      emptyCompanyLegalFormDraft(),
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    const errors = fieldErrorsFromDraftSchema(parsed.error);
    expect(errors.legalName).toBe("required");
    expect(errors.edrpou).toBeNull();
    expect(errors.iban).toBeNull();
    expect(errors.bankEdrpou).toBeNull();
    if (errors.legalName === null) {
      return;
    }
    expect(isNameErrorKey(errors.legalName)).toBe(true);
    expect(validateCompanyLegalForm(validDraft())).toEqual({
      legalName: null,
      companyType: null,
      edrpou: null,
      legalAddress: null,
      iban: null,
      bankName: null,
      bankMfo: null,
      bankEdrpou: null,
      phone: null,
      email: null,
    });
    expect(
      companyLegalFormDraftSchema.safeParse({
        ...validDraft(),
        companyType: "tov",
      }).success,
    ).toBe(true);
  });

  it("rejects over-max legal name and optional fields", () => {
    const parsed = companyLegalFormDraftSchema.safeParse({
      ...emptyCompanyLegalFormDraft(),
      legalName: "x".repeat(COMPANY_LEGAL_NAME_MAX + 1),
      edrpou: "1".repeat(COMPANY_LEGAL_EDRPOU_MAX + 1),
      legalAddress: "a".repeat(COMPANY_LEGAL_ADDRESS_MAX + 1),
      iban: "U".repeat(COMPANY_LEGAL_IBAN_MAX + 1),
      bankName: "b".repeat(COMPANY_LEGAL_BANK_NAME_MAX + 1),
      bankMfo: "3".repeat(COMPANY_LEGAL_BANK_MFO_MAX + 1),
      bankEdrpou: "4".repeat(COMPANY_LEGAL_BANK_EDRPOU_MAX + 1),
      phone: "5".repeat(COMPANY_LEGAL_PHONE_MAX + 1),
      email: `${"e".repeat(COMPANY_LEGAL_EMAIL_MAX)}@x`,
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    const errors = fieldErrorsFromDraftSchema(parsed.error);
    expect(errors.legalName).toBe("too_long");
    expect(errors.edrpou).toBe("too_long");
    expect(errors.legalAddress).toBe("too_long");
    expect(errors.iban).toBe("too_long");
    expect(errors.bankName).toBe("too_long");
    expect(errors.bankMfo).toBe("too_long");
    expect(errors.bankEdrpou).toBe("too_long");
    expect(errors.phone).toBe("too_long");
    expect(errors.email).toBe("too_long");
  });

  it("rejects a company type that is not ФОП or ТОВ", () => {
    const parsed = companyLegalFormDraftSchema.safeParse({
      ...validDraft(),
      companyType: "llc",
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(fieldErrorsFromDraftSchema(parsed.error).companyType).toBe(
      "invalid",
    );
  });
});

describe("companyLegalFormResolver copy keys", () => {
  it("maps error keys to copy keys and never uses issue.message as copy", async () => {
    const result = await companyLegalFormResolver(
      emptyCompanyLegalFormDraft(),
      undefined,
      { fields: {}, shouldUseNativeValidation: false },
    );
    const nameKey = result.errors.legalName?.message;
    expect(nameKey).toBe("required");
    expect(nameKey).not.toBe(copy.errors.legalNameRequired);
    if (nameKey === undefined || !isNameErrorKey(nameKey)) {
      return;
    }
    const resolved = resolveCompanyLegalFormCopy(copy, {
      mode: "add",
      legalNameError: nameKey,
      companyTypeError: null,
      edrpouError: null,
      legalAddressError: null,
      ibanError: null,
      bankNameError: null,
      bankMfoError: null,
      bankEdrpouError: null,
      phoneError: null,
      emailError: null,
      banner: null,
      pending: false,
      clientReady: true,
      empty: true,
      dirty: false,
    });
    expect(resolved.legalNameError).toBe(copy.errors.legalNameRequired);
  });
});

describe("parseCompanyLegalFormUiDraft", () => {
  it("fails a blank unsaved add and accepts a trimmed name", () => {
    expect(parseCompanyLegalFormUiDraft(emptyCompanyLegalFormDraft()).ok).toBe(
      false,
    );
    const parsed = parseCompanyLegalFormUiDraft({
      ...emptyCompanyLegalFormDraft(),
      legalName: "  ФОП Іваненко  ",
    });
    expect(parsed.ok).toBe(true);
  });
});
