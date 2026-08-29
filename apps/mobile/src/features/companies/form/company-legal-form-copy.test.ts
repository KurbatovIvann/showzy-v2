import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import { companiesCopy } from "../../../i18n/companies";
import {
  fieldErrorsFromFormState,
  mapCompanyLegalFormFailure,
  mapValidationIssues,
  resolveCompanyLegalFormCopy,
  rhfPathsForFieldErrors,
} from "./company-legal-form-copy";
import type { CompanyLegalFormWrite } from "./company-legal-form-plan";
import { emptyFieldErrors } from "./company-legal-form.schema";

const copy = companiesCopy("uk").legalForm;

const write: CompanyLegalFormWrite = {
  kind: "updateLegal",
  input: {
    companyType: "fop",
    legalName: "ФОП Іваненко",
    edrpou: null,
    legalAddress: null,
    iban: null,
    bankName: null,
    bankMfo: null,
    bankEdrpou: null,
    phone: null,
    email: null,
  },
};

describe("mapCompanyLegalFormFailure / mapValidationIssues", () => {
  it("maps wire kinds without reading error messages", () => {
    expect(mapCompanyLegalFormFailure("network")).toBe("network");
    expect(mapCompanyLegalFormFailure("offline")).toBe("offline");
    expect(mapCompanyLegalFormFailure("permission")).toBe("permission");
    expect(mapCompanyLegalFormFailure("conflict")).toBe("conflict");
    expect(mapCompanyLegalFormFailure("conflict", "RETRY_IN_PROGRESS")).toBe(
      "unavailable",
    );
    expect(mapCompanyLegalFormFailure("validation")).toBe("validation");
  });

  it("maps VALIDATION issues onto fields by path", () => {
    const error: unknown = new ORPCError("VALIDATION", {
      defined: true,
      status: 400,
      message: "do-not-match-this",
      data: {
        issues: [
          { code: "too_small", path: ["legalName"], message: "secret" },
          { code: "too_big", path: ["edrpou"], message: "secret" },
          { code: "too_big", path: ["iban"], message: "secret" },
          { code: "too_big", path: ["bankEdrpou"], message: "secret" },
          { code: "invalid_value", path: ["companyType"], message: "secret" },
        ],
      },
    });
    expect(mapValidationIssues(error, write)).toEqual({
      legalName: "required",
      companyType: "invalid",
      edrpou: "too_long",
      legalAddress: null,
      iban: "too_long",
      bankName: null,
      bankMfo: null,
      bankEdrpou: "too_long",
      phone: null,
      email: null,
    });
  });
});

describe("fieldErrorsFromFormState", () => {
  it("maps submitted RHF messages onto draft keys", () => {
    expect(
      fieldErrorsFromFormState({
        submitted: true,
        legalNameMessage: "required",
        companyTypeMessage: "invalid",
        edrpouMessage: "too_long",
        legalAddressMessage: undefined,
        ibanMessage: undefined,
        bankNameMessage: undefined,
        bankMfoMessage: undefined,
        bankEdrpouMessage: undefined,
        phoneMessage: undefined,
        emailMessage: undefined,
        server: null,
      }),
    ).toEqual({
      legalName: "required",
      companyType: "invalid",
      edrpou: "too_long",
      legalAddress: null,
      iban: null,
      bankName: null,
      bankMfo: null,
      bankEdrpou: null,
      phone: null,
      email: null,
    });
  });
});

describe("rhfPathsForFieldErrors", () => {
  it("puts legalName required on the legalName field", () => {
    expect(
      rhfPathsForFieldErrors({
        ...emptyFieldErrors(),
        legalName: "required",
      }),
    ).toEqual([{ name: "legalName", message: "required" }]);
  });
});

describe("resolveCompanyLegalFormCopy", () => {
  it("disables save on an empty first add and on a clean edit", () => {
    const errors = {
      legalNameError: null,
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
    } as const;
    const addEmpty = resolveCompanyLegalFormCopy(copy, {
      ...errors,
      mode: "add",
      empty: true,
      dirty: false,
    });
    expect(addEmpty.submitDisabled).toBe(true);
    expect(addEmpty.submitLabel).toBe(copy.submitAdd);

    const addFilled = resolveCompanyLegalFormCopy(copy, {
      ...errors,
      mode: "add",
      empty: false,
      dirty: true,
    });
    expect(addFilled.submitDisabled).toBe(false);

    const editClean = resolveCompanyLegalFormCopy(copy, {
      ...errors,
      mode: "edit",
      empty: false,
      dirty: false,
    });
    expect(editClean.submitDisabled).toBe(true);
    expect(editClean.submitLabel).toBe(copy.submitEdit);

    const editDirty = resolveCompanyLegalFormCopy(copy, {
      ...errors,
      mode: "edit",
      empty: false,
      dirty: true,
    });
    expect(editDirty.submitDisabled).toBe(false);
  });
});
