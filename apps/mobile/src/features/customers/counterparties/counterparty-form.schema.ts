/**
 * UI draft Zod for the counterparty form (SHO-196). Caps from
 * `@showzy/validation/customers`. This is not the customers action wire
 * schema. Optional strings may be blank; the planner stores empty as
 * null. EDRPOU / IBAN / MFO are length-capped only — no extra format
 * CHECKs (feature card).
 */
import { zodResolver } from "@hookform/resolvers/zod";
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
} from "@showzy/validation/customers";
import { z } from "zod";

export {
  COUNTERPARTY_BANK_MFO_MAX,
  COUNTERPARTY_BANK_NAME_MAX,
  COUNTERPARTY_EDRPOU_MAX,
  COUNTERPARTY_EMAIL_MAX,
  COUNTERPARTY_IBAN_MAX,
  COUNTERPARTY_LEGAL_ADDRESS_MAX,
  COUNTERPARTY_NAME_MAX,
  COUNTERPARTY_NOTES_MAX,
  COUNTERPARTY_PHONE_MAX,
};

export type NameErrorKey = "required" | "too_long";
export type LengthErrorKey = "too_long";

export type CounterpartyLengthField =
  | "edrpou"
  | "legalAddress"
  | "iban"
  | "bankName"
  | "bankMfo"
  | "phone"
  | "email"
  | "notes";

export type CounterpartyFormFieldErrors = {
  readonly name: NameErrorKey | null;
  readonly edrpou: LengthErrorKey | null;
  readonly legalAddress: LengthErrorKey | null;
  readonly iban: LengthErrorKey | null;
  readonly bankName: LengthErrorKey | null;
  readonly bankMfo: LengthErrorKey | null;
  readonly phone: LengthErrorKey | null;
  readonly email: LengthErrorKey | null;
  readonly notes: LengthErrorKey | null;
};

const LENGTH_FIELDS: readonly CounterpartyLengthField[] = [
  "edrpou",
  "legalAddress",
  "iban",
  "bankName",
  "bankMfo",
  "phone",
  "email",
  "notes",
];

export function emptyFieldErrors(): CounterpartyFormFieldErrors {
  return {
    name: null,
    edrpou: null,
    legalAddress: null,
    iban: null,
    bankName: null,
    bankMfo: null,
    phone: null,
    email: null,
    notes: null,
  };
}

export function isNameErrorKey(value: string): value is NameErrorKey {
  return value === "required" || value === "too_long";
}

export function isLengthErrorKey(value: string): value is LengthErrorKey {
  return value === "too_long";
}

function isLengthField(value: unknown): value is CounterpartyLengthField {
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

export const counterpartyFormNameSchema = z
  .string()
  .refine((value) => value.trim().length > 0, { message: "required" })
  .refine((value) => value.trim().length <= COUNTERPARTY_NAME_MAX, {
    message: "too_long",
  });

export const counterpartyFormDraftSchema = z.object({
  name: counterpartyFormNameSchema,
  edrpou: cappedOptional(COUNTERPARTY_EDRPOU_MAX),
  legalAddress: cappedOptional(COUNTERPARTY_LEGAL_ADDRESS_MAX),
  iban: cappedOptional(COUNTERPARTY_IBAN_MAX),
  bankName: cappedOptional(COUNTERPARTY_BANK_NAME_MAX),
  bankMfo: cappedOptional(COUNTERPARTY_BANK_MFO_MAX),
  phone: cappedOptional(COUNTERPARTY_PHONE_MAX),
  email: cappedOptional(COUNTERPARTY_EMAIL_MAX),
  notes: cappedOptional(COUNTERPARTY_NOTES_MAX),
  customerId: z.uuid().nullable(),
});

export const counterpartyFormResolver = zodResolver(
  counterpartyFormDraftSchema,
);

/**
 * Map UI-schema issues onto field copy keys. The schema `message` values
 * are keys (`required` / `too_long`), never user-facing copy.
 */
export function fieldErrorsFromDraftSchema(
  error: z.ZodError,
): CounterpartyFormFieldErrors {
  const next = emptyFieldErrors();
  let name: NameErrorKey | null = next.name;
  const length: Record<CounterpartyLengthField, LengthErrorKey | null> = {
    edrpou: null,
    legalAddress: null,
    iban: null,
    bankName: null,
    bankMfo: null,
    phone: null,
    email: null,
    notes: null,
  };
  for (const issue of error.issues) {
    const root = issue.path[0];
    if (root === "name" && isNameErrorKey(issue.message)) {
      name = issue.message;
      continue;
    }
    if (isLengthField(root) && isLengthErrorKey(issue.message)) {
      length[root] = issue.message;
    }
  }
  return { name, ...length };
}
