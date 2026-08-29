/**
 * Shared staff company identity + seller legal-face view (SHO-224 /
 * feature SHO-222). Get, updateLegal, and getSellerFacts import this
 * shape so documents `ctx.call` does not invent a second projection.
 *
 * Caps copied from the counterparty view (SHO-191): edrpou 10, address
 * 500, iban 34, bank name 200, MFO 6, phone 30, email 200. Card-named
 * extras: legalName 300, bankEdrpou 8. No IBAN/EDRPOU format library —
 * length caps only, same as counterparties.
 *
 * No `companyId` on input or on the legal object. Identity is `name` /
 * `slug` / `prefix` from `companies`; `legal` is null when no
 * `company_legal_info` row exists.
 */
import { z } from "zod";

export const COMPANY_LEGAL_NAME_MAX = 300;
export const COMPANY_LEGAL_EDRPOU_MAX = 10;
export const COMPANY_LEGAL_ADDRESS_MAX = 500;
export const COMPANY_LEGAL_IBAN_MAX = 34;
export const COMPANY_LEGAL_BANK_NAME_MAX = 200;
export const COMPANY_LEGAL_BANK_MFO_MAX = 6;
export const COMPANY_LEGAL_BANK_EDRPOU_MAX = 8;
export const COMPANY_LEGAL_PHONE_MAX = 30;
export const COMPANY_LEGAL_EMAIL_MAX = 200;

export const companyLegalTypeSchema = z.enum(["fop", "tov"]);

export const companyLegalNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Legal name must not be blank." })
  .max(COMPANY_LEGAL_NAME_MAX);

export const companyLegalEdrpouSchema = z
  .string()
  .trim()
  .max(COMPANY_LEGAL_EDRPOU_MAX)
  .nullable()
  .optional();

export const companyLegalAddressSchema = z
  .string()
  .trim()
  .max(COMPANY_LEGAL_ADDRESS_MAX)
  .nullable()
  .optional();

export const companyLegalIbanSchema = z
  .string()
  .trim()
  .max(COMPANY_LEGAL_IBAN_MAX)
  .nullable()
  .optional();

export const companyLegalBankNameSchema = z
  .string()
  .trim()
  .max(COMPANY_LEGAL_BANK_NAME_MAX)
  .nullable()
  .optional();

export const companyLegalBankMfoSchema = z
  .string()
  .trim()
  .max(COMPANY_LEGAL_BANK_MFO_MAX)
  .nullable()
  .optional();

export const companyLegalBankEdrpouSchema = z
  .string()
  .trim()
  .max(COMPANY_LEGAL_BANK_EDRPOU_MAX)
  .nullable()
  .optional();

export const companyLegalPhoneSchema = z
  .string()
  .trim()
  .max(COMPANY_LEGAL_PHONE_MAX)
  .nullable()
  .optional();

export const companyLegalEmailSchema = z
  .string()
  .trim()
  .max(COMPANY_LEGAL_EMAIL_MAX)
  .nullable()
  .optional();

export const companyLegalInfoViewSchema = z.object({
  id: z.uuid(),
  companyType: companyLegalTypeSchema,
  legalName: z.string().nullable(),
  edrpou: z.string().nullable(),
  legalAddress: z.string().nullable(),
  iban: z.string().nullable(),
  bankName: z.string().nullable(),
  bankMfo: z.string().nullable(),
  bankEdrpou: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const companyViewSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  prefix: z.string(),
  legal: companyLegalInfoViewSchema.nullable(),
});
