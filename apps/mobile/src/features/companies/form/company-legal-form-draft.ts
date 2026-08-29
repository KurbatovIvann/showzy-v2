/**
 * Company legal form draft, snapshot, and dirty detection (SHO-225).
 * UI Zod lives in `company-legal-form.schema.ts`; write planning is
 * `company-legal-form-plan.ts`.
 */
import type { CompanyLegalView } from "../api/company.queries";
import {
  companyLegalFormDraftSchema,
  emptyFieldErrors,
  fieldErrorsFromDraftSchema,
  type CompanyLegalFormFieldErrors,
  type CompanyLegalType,
} from "./company-legal-form.schema";

export {
  emptyFieldErrors,
  type CompanyLegalFormFieldErrors,
  type CompanyLegalLengthField,
  type CompanyLegalType,
  type CompanyTypeErrorKey,
  type LengthErrorKey,
  type NameErrorKey,
} from "./company-legal-form.schema";

export type CompanyLegalFormMode = "add" | "edit";

export type CompanyLegalFormDraft = {
  companyType: CompanyLegalType;
  legalName: string;
  edrpou: string;
  legalAddress: string;
  iban: string;
  bankName: string;
  bankMfo: string;
  bankEdrpou: string;
  phone: string;
  email: string;
};

export type CompanyLegalFormSnapshot = {
  readonly companyType: CompanyLegalType;
  readonly legalName: string;
  readonly edrpou: string | null;
  readonly legalAddress: string | null;
  readonly iban: string | null;
  readonly bankName: string | null;
  readonly bankMfo: string | null;
  readonly bankEdrpou: string | null;
  readonly phone: string | null;
  readonly email: string | null;
};

export function companyTypeFromWatch(value: unknown): CompanyLegalType {
  return value === "tov" ? "tov" : "fop";
}

export function emptyCompanyLegalFormDraft(): CompanyLegalFormDraft {
  return {
    companyType: "fop",
    legalName: "",
    edrpou: "",
    legalAddress: "",
    iban: "",
    bankName: "",
    bankMfo: "",
    bankEdrpou: "",
    phone: "",
    email: "",
  };
}

export function cloneCompanyLegalFormDraft(
  values: CompanyLegalFormDraft,
): CompanyLegalFormDraft {
  return {
    companyType: values.companyType,
    legalName: values.legalName,
    edrpou: values.edrpou,
    legalAddress: values.legalAddress,
    iban: values.iban,
    bankName: values.bankName,
    bankMfo: values.bankMfo,
    bankEdrpou: values.bankEdrpou,
    phone: values.phone,
    email: values.email,
  };
}

function textOrEmpty(value: string | null): string {
  return value ?? "";
}

export function draftFromCompanyLegal(
  legal: CompanyLegalView,
): CompanyLegalFormDraft {
  if (legal === null) {
    return emptyCompanyLegalFormDraft();
  }
  return {
    companyType: legal.companyType,
    legalName: textOrEmpty(legal.legalName),
    edrpou: textOrEmpty(legal.edrpou),
    legalAddress: textOrEmpty(legal.legalAddress),
    iban: textOrEmpty(legal.iban),
    bankName: textOrEmpty(legal.bankName),
    bankMfo: textOrEmpty(legal.bankMfo),
    bankEdrpou: textOrEmpty(legal.bankEdrpou),
    phone: textOrEmpty(legal.phone),
    email: textOrEmpty(legal.email),
  };
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function snapshotFromCompanyLegal(
  legal: CompanyLegalView,
): CompanyLegalFormSnapshot | null {
  if (legal === null) {
    return null;
  }
  return {
    companyType: legal.companyType,
    legalName: (legal.legalName ?? "").trim(),
    edrpou: legal.edrpou,
    legalAddress: legal.legalAddress,
    iban: legal.iban,
    bankName: legal.bankName,
    bankMfo: legal.bankMfo,
    bankEdrpou: legal.bankEdrpou,
    phone: legal.phone,
    email: legal.email,
  };
}

export function isCompanyLegalDraftEmpty(
  draft: CompanyLegalFormDraft,
): boolean {
  return (
    draft.legalName.trim().length === 0 &&
    draft.edrpou.trim().length === 0 &&
    draft.legalAddress.trim().length === 0 &&
    draft.iban.trim().length === 0 &&
    draft.bankName.trim().length === 0 &&
    draft.bankMfo.trim().length === 0 &&
    draft.bankEdrpou.trim().length === 0 &&
    draft.phone.trim().length === 0 &&
    draft.email.trim().length === 0
  );
}

export function isCompanyLegalFormDirty(
  draft: CompanyLegalFormDraft,
  origin: CompanyLegalFormDraft,
): boolean {
  return (
    draft.companyType !== origin.companyType ||
    draft.legalName !== origin.legalName ||
    draft.edrpou !== origin.edrpou ||
    draft.legalAddress !== origin.legalAddress ||
    draft.iban !== origin.iban ||
    draft.bankName !== origin.bankName ||
    draft.bankMfo !== origin.bankMfo ||
    draft.bankEdrpou !== origin.bankEdrpou ||
    draft.phone !== origin.phone ||
    draft.email !== origin.email
  );
}

export function companyLegalFormFieldChanged(
  mode: CompanyLegalFormMode,
  current: string | null,
  origin: string | null,
): boolean {
  return mode === "edit" && current !== origin;
}

export function validateCompanyLegalForm(
  draft: CompanyLegalFormDraft,
): CompanyLegalFormFieldErrors {
  const parsed = companyLegalFormDraftSchema.safeParse(draft);
  if (parsed.success) {
    return emptyFieldErrors();
  }
  return fieldErrorsFromDraftSchema(parsed.error);
}

export function isCompanyLegalFormValid(
  errors: CompanyLegalFormFieldErrors,
): boolean {
  return (
    errors.legalName === null &&
    errors.companyType === null &&
    errors.edrpou === null &&
    errors.legalAddress === null &&
    errors.iban === null &&
    errors.bankName === null &&
    errors.bankMfo === null &&
    errors.bankEdrpou === null &&
    errors.phone === null &&
    errors.email === null
  );
}

export type CompanyLegalFormUiParse =
  | { readonly ok: true; readonly draft: CompanyLegalFormDraft }
  | { readonly ok: false; readonly errors: CompanyLegalFormFieldErrors };

export function parseCompanyLegalFormUiDraft(
  draft: CompanyLegalFormDraft,
): CompanyLegalFormUiParse {
  const errors = validateCompanyLegalForm(draft);
  if (!isCompanyLegalFormValid(errors)) {
    return { ok: false, errors };
  }
  return { ok: true, draft };
}

export function snapshotFromDraft(
  draft: CompanyLegalFormDraft,
): CompanyLegalFormSnapshot | null {
  const errors = validateCompanyLegalForm(draft);
  if (!isCompanyLegalFormValid(errors)) {
    return null;
  }
  return {
    companyType: draft.companyType,
    legalName: draft.legalName.trim(),
    edrpou: emptyToNull(draft.edrpou),
    legalAddress: emptyToNull(draft.legalAddress),
    iban: emptyToNull(draft.iban),
    bankName: emptyToNull(draft.bankName),
    bankMfo: emptyToNull(draft.bankMfo),
    bankEdrpou: emptyToNull(draft.bankEdrpou),
    phone: emptyToNull(draft.phone),
    email: emptyToNull(draft.email),
  };
}
