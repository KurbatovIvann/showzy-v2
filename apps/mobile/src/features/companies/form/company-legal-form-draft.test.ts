import { describe, expect, it } from "vitest";

import type { CompanyLegalView } from "../api/company.queries";
import {
  companyTypeFromWatch,
  draftFromCompanyLegal,
  emptyCompanyLegalFormDraft,
  isCompanyLegalDraftEmpty,
  isCompanyLegalFormDirty,
  parseCompanyLegalFormUiDraft,
  snapshotFromCompanyLegal,
  snapshotFromDraft,
  type CompanyLegalFormDraft,
} from "./company-legal-form-draft";

const SAMPLE_UA_IBAN = "UA000000000000000000000000000";

const filledLegal: NonNullable<CompanyLegalView> = {
  id: "11111111-1111-4111-8111-111111111111",
  companyType: "tov",
  legalName: "ТОВ Софі",
  edrpou: "3312456789",
  legalAddress: "м. Київ, вул. Хрещатик, 1",
  iban: SAMPLE_UA_IBAN,
  bankName: "АТ КБ «ПриватБанк»",
  bankMfo: "322313",
  bankEdrpou: "12345678",
  phone: "+380440000000",
  email: "docs@example.com",
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
};

function validAddDraft(): CompanyLegalFormDraft {
  return {
    ...emptyCompanyLegalFormDraft(),
    legalName: "  ФОП Іваненко  ",
  };
}

describe("draftFromCompanyLegal / snapshotFromCompanyLegal", () => {
  it("hydrates an empty add draft when legal is null", () => {
    expect(draftFromCompanyLegal(null)).toEqual(emptyCompanyLegalFormDraft());
    expect(snapshotFromCompanyLegal(null)).toBeNull();
    expect(emptyCompanyLegalFormDraft().companyType).toBe("fop");
  });

  it("prefills every field from a filled legal row", () => {
    expect(draftFromCompanyLegal(filledLegal)).toEqual({
      companyType: "tov",
      legalName: "ТОВ Софі",
      edrpou: "3312456789",
      legalAddress: "м. Київ, вул. Хрещатик, 1",
      iban: SAMPLE_UA_IBAN,
      bankName: "АТ КБ «ПриватБанк»",
      bankMfo: "322313",
      bankEdrpou: "12345678",
      phone: "+380440000000",
      email: "docs@example.com",
    });
    expect(snapshotFromCompanyLegal(filledLegal)).toEqual({
      companyType: "tov",
      legalName: "ТОВ Софі",
      edrpou: "3312456789",
      legalAddress: "м. Київ, вул. Хрещатик, 1",
      iban: SAMPLE_UA_IBAN,
      bankName: "АТ КБ «ПриватБанк»",
      bankMfo: "322313",
      bankEdrpou: "12345678",
      phone: "+380440000000",
      email: "docs@example.com",
    });
  });
});

describe("isCompanyLegalFormDirty / isCompanyLegalDraftEmpty", () => {
  it("is clean against the origin and dirty after a type or name change", () => {
    const origin = draftFromCompanyLegal(filledLegal);
    expect(isCompanyLegalFormDirty(origin, origin)).toBe(false);
    expect(
      isCompanyLegalFormDirty({ ...origin, legalName: "Інша" }, origin),
    ).toBe(true);
    expect(
      isCompanyLegalFormDirty({ ...origin, companyType: "fop" }, origin),
    ).toBe(true);
  });

  it("treats a TOV-only first add as still empty", () => {
    expect(isCompanyLegalDraftEmpty(emptyCompanyLegalFormDraft())).toBe(true);
    expect(
      isCompanyLegalDraftEmpty({
        ...emptyCompanyLegalFormDraft(),
        companyType: "tov",
      }),
    ).toBe(true);
    expect(isCompanyLegalDraftEmpty(validAddDraft())).toBe(false);
  });
});

describe("snapshotFromDraft", () => {
  it("trims legal name and turns blank optionals into null", () => {
    expect(snapshotFromDraft(validAddDraft())).toEqual({
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
    });
    expect(snapshotFromDraft(emptyCompanyLegalFormDraft())).toBeNull();
    expect(parseCompanyLegalFormUiDraft(validAddDraft()).ok).toBe(true);
  });
});

describe("companyTypeFromWatch", () => {
  it("keeps ФОП/ТОВ and falls back to ФОП", () => {
    expect(companyTypeFromWatch("fop")).toBe("fop");
    expect(companyTypeFromWatch("tov")).toBe("tov");
    expect(companyTypeFromWatch("llc")).toBe("fop");
    expect(companyTypeFromWatch(undefined)).toBe("fop");
  });
});
