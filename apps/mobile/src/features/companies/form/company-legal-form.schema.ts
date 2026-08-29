/**
 * UI draft Zod for the company legal editor (SHO-225). Caps from
 * `shared/company-caps.ts` (same numbers as `companies.updateLegal`).
 * This is not the action wire schema. Optional strings may be blank;
 * the planner stores empty as null. EDRPOU / IBAN / MFO are
 * length-capped only — no extra format CHECKs (feature card).
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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
} from "../shared/company-caps";

export {
  COMPANY_LEGAL_ADDRESS_MAX,
  COMPANY_LEGAL_BANK_EDRPOU_MAX,
  COMPANY_LEGAL_BANK_MFO_MAX,
  COMPANY_LEGAL_BANK_NAME_MAX,
  COMPANY_LEGAL_EDRPOU_MAX,
  COMPANY_LEGAL_EMAIL_MAX,
  COMPANY_LEGAL_IBAN_MAX,
  COMPANY_LEGAL_NAME_MAX,
  COMPANY_LEGAL_PHONE_MAX,
};

export type CompanyLegalType = "fop" | "tov";
export type NameErrorKey = "required" | "too_long";
export type LengthErrorKey = "too_long";
export type CompanyTypeErrorKey = "invalid";

export type CompanyLegalLengthField =
  | "edrpou"
  | "legalAddress"
  | "iban"
  | "bankName"
  | "bankMfo"
  | "bankEdrpou"
  | "phone"
  | "email";

export type CompanyLegalFormFieldErrors = {
  readonly legalName: NameErrorKey | null;
  readonly companyType: CompanyTypeErrorKey | null;
  readonly edrpou: LengthErrorKey | null;
  readonly legalAddress: LengthErrorKey | null;
  readonly iban: LengthErrorKey | null;
  readonly bankName: LengthErrorKey | null;
  readonly bankMfo: LengthErrorKey | null;
  readonly bankEdrpou: LengthErrorKey | null;
  readonly phone: LengthErrorKey | null;
  readonly email: LengthErrorKey | null;
};

const LENGTH_FIELDS: readonly CompanyLegalLengthField[] = [
  "edrpou",
  "legalAddress",
  "iban",
  "bankName",
  "bankMfo",
  "bankEdrpou",
  "phone",
  "email",
];

export function emptyFieldErrors(): CompanyLegalFormFieldErrors {
  return {
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
  };
}

export function isNameErrorKey(value: string): value is NameErrorKey {
  return value === "required" || value === "too_long";
}

export function isLengthErrorKey(value: string): value is LengthErrorKey {
  return value === "too_long";
}

export function isCompanyTypeErrorKey(
  value: string,
): value is CompanyTypeErrorKey {
  return value === "invalid";
}

function isLengthField(value: unknown): value is CompanyLegalLengthField {
  return (
    typeof value === "string" &&
    (LENGTH_FIELDS as readonly string[]).includes(value)
  );
}

function cappedOptional(max: number) {
  return z.string().refine((value) => value.trim().length <= max, {
    message: "too_long",
  });
}

export const companyLegalFormNameSchema = z
  .string()
  .refine((value) => value.trim().length > 0, { message: "required" })
  .refine((value) => value.trim().length <= COMPANY_LEGAL_NAME_MAX, {
    message: "too_long",
  });

export const companyLegalFormDraftSchema = z.object({
  companyType: z
    .string()
    .refine(
      (value): value is CompanyLegalType => value === "fop" || value === "tov",
      { message: "invalid" },
    ),
  legalName: companyLegalFormNameSchema,
  edrpou: cappedOptional(COMPANY_LEGAL_EDRPOU_MAX),
  legalAddress: cappedOptional(COMPANY_LEGAL_ADDRESS_MAX),
  iban: cappedOptional(COMPANY_LEGAL_IBAN_MAX),
  bankName: cappedOptional(COMPANY_LEGAL_BANK_NAME_MAX),
  bankMfo: cappedOptional(COMPANY_LEGAL_BANK_MFO_MAX),
  bankEdrpou: cappedOptional(COMPANY_LEGAL_BANK_EDRPOU_MAX),
  phone: cappedOptional(COMPANY_LEGAL_PHONE_MAX),
  email: cappedOptional(COMPANY_LEGAL_EMAIL_MAX),
});

export const companyLegalFormResolver = zodResolver(
  companyLegalFormDraftSchema,
);

/**
 * Map UI-schema issues onto field copy keys. The schema `message` values
 * are keys (`required` / `too_long` / `invalid`), never user-facing copy.
 */
export function fieldErrorsFromDraftSchema(
  error: z.ZodError,
): CompanyLegalFormFieldErrors {
  const next = emptyFieldErrors();
  let legalName: NameErrorKey | null = next.legalName;
  let companyType: CompanyTypeErrorKey | null = next.companyType;
  const length: Record<CompanyLegalLengthField, LengthErrorKey | null> = {
    edrpou: null,
    legalAddress: null,
    iban: null,
    bankName: null,
    bankMfo: null,
    bankEdrpou: null,
    phone: null,
    email: null,
  };
  for (const issue of error.issues) {
    const root = issue.path[0];
    if (root === "legalName" && isNameErrorKey(issue.message)) {
      legalName = issue.message;
      continue;
    }
    if (root === "companyType" && isCompanyTypeErrorKey(issue.message)) {
      companyType = issue.message;
      continue;
    }
    if (isLengthField(root) && isLengthErrorKey(issue.message)) {
      length[root] = issue.message;
    }
  }
  return { legalName, companyType, ...length };
}
