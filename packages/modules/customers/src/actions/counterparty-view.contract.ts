/**
 * Shared company-owned legal-face view (SHO-192 / feature SHO-191).
 * Create and update import this shape so T11 list/get do not invent a
 * second projection. Mechanical caps the feature card named: name 300
 * (legal name, not CRM 120), edrpou 10, legalAddress 500, iban 34,
 * bankName 200, bankMfo 6, phone 30, email 200, notes 2000.
 *
 * No `companyId`, group, price list, user, archive/status, or `kind`.
 * `customerName` is a live join to `company_customers.name` (null when
 * standalone).
 */
import { z } from "zod";

export const COUNTERPARTY_NAME_MAX = 300;
export const COUNTERPARTY_EDRPOU_MAX = 10;
export const COUNTERPARTY_LEGAL_ADDRESS_MAX = 500;
export const COUNTERPARTY_IBAN_MAX = 34;
export const COUNTERPARTY_BANK_NAME_MAX = 200;
export const COUNTERPARTY_BANK_MFO_MAX = 6;
export const COUNTERPARTY_PHONE_MAX = 30;
export const COUNTERPARTY_EMAIL_MAX = 200;
export const COUNTERPARTY_NOTES_MAX = 2000;

export const counterpartyNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Name must not be blank." })
  .max(COUNTERPARTY_NAME_MAX);

export const counterpartyEdrpouSchema = z
  .string()
  .trim()
  .max(COUNTERPARTY_EDRPOU_MAX)
  .nullable()
  .optional();

export const counterpartyLegalAddressSchema = z
  .string()
  .trim()
  .max(COUNTERPARTY_LEGAL_ADDRESS_MAX)
  .nullable()
  .optional();

export const counterpartyIbanSchema = z
  .string()
  .trim()
  .max(COUNTERPARTY_IBAN_MAX)
  .nullable()
  .optional();

export const counterpartyBankNameSchema = z
  .string()
  .trim()
  .max(COUNTERPARTY_BANK_NAME_MAX)
  .nullable()
  .optional();

export const counterpartyBankMfoSchema = z
  .string()
  .trim()
  .max(COUNTERPARTY_BANK_MFO_MAX)
  .nullable()
  .optional();

export const counterpartyPhoneSchema = z
  .string()
  .trim()
  .max(COUNTERPARTY_PHONE_MAX)
  .nullable()
  .optional();

export const counterpartyEmailSchema = z
  .string()
  .trim()
  .max(COUNTERPARTY_EMAIL_MAX)
  .nullable()
  .optional();

export const counterpartyNotesSchema = z
  .string()
  .trim()
  .max(COUNTERPARTY_NOTES_MAX)
  .nullable()
  .optional();

export const counterpartyCustomerIdSchema = z.uuid().nullable().optional();

export const counterpartyViewSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  edrpou: z.string().nullable(),
  legalAddress: z.string().nullable(),
  iban: z.string().nullable(),
  bankName: z.string().nullable(),
  bankMfo: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  notes: z.string().nullable(),
  customerId: z.uuid().nullable(),
  customerName: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
