/**
 * UI draft Zod for the customer form (SHO-180). Caps from
 * `@showzy/validation/customers`. This is not the customers action wire
 * schema. Contact refine is phone **or** email **or** a kept `userId`
 * (the UI cannot set `userId`).
 */
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CUSTOMER_EMAIL_MAX,
  CUSTOMER_NAME_MAX,
  CUSTOMER_NOTES_MAX,
  CUSTOMER_PHONE_MAX,
} from "@showzy/validation/customers";
import { z } from "zod";

export {
  CUSTOMER_EMAIL_MAX,
  CUSTOMER_NAME_MAX,
  CUSTOMER_NOTES_MAX,
  CUSTOMER_PHONE_MAX,
};

export type NameErrorKey = "required" | "too_long";
export type LengthErrorKey = "too_long";
export type ContactErrorKey = "required";

export type CustomerFormFieldErrors = {
  readonly name: NameErrorKey | null;
  readonly phone: LengthErrorKey | null;
  readonly email: LengthErrorKey | null;
  readonly notes: LengthErrorKey | null;
  readonly contact: ContactErrorKey | null;
};

export function emptyFieldErrors(): CustomerFormFieldErrors {
  return {
    name: null,
    phone: null,
    email: null,
    notes: null,
    contact: null,
  };
}

export function isNameErrorKey(value: string): value is NameErrorKey {
  return value === "required" || value === "too_long";
}

export function isLengthErrorKey(value: string): value is LengthErrorKey {
  return value === "too_long";
}

export function isContactErrorKey(value: string): value is ContactErrorKey {
  return value === "required" || value === "contact";
}

function cappedOptional(max: number) {
  return z.string().refine((value) => value.trim().length <= max, {
    message: "too_long",
  });
}

export const customerFormNameSchema = z
  .string()
  .refine((value) => value.trim().length > 0, { message: "required" })
  .refine((value) => value.trim().length <= CUSTOMER_NAME_MAX, {
    message: "too_long",
  });

export const customerFormDraftSchema = z
  .object({
    name: customerFormNameSchema,
    phone: cappedOptional(CUSTOMER_PHONE_MAX),
    email: cappedOptional(CUSTOMER_EMAIL_MAX),
    notes: cappedOptional(CUSTOMER_NOTES_MAX),
    groupId: z.uuid().nullable(),
    priceListId: z.uuid().nullable(),
    userId: z.string().nullable(),
  })
  .refine(
    (draft) => {
      if (draft.phone.trim().length > 0 || draft.email.trim().length > 0) {
        return true;
      }
      return draft.userId !== null && draft.userId.trim().length > 0;
    },
    { message: "contact", path: ["phone"] },
  );

export const customerFormResolver = zodResolver(customerFormDraftSchema);

/**
 * Map UI-schema issues onto field copy keys. The schema `message` values
 * are keys (`required` / `too_long` / `contact`), never user-facing copy.
 */
export function fieldErrorsFromDraftSchema(
  error: z.ZodError,
): CustomerFormFieldErrors {
  let name: NameErrorKey | null = null;
  let phone: LengthErrorKey | null = null;
  let email: LengthErrorKey | null = null;
  let notes: LengthErrorKey | null = null;
  let contact: ContactErrorKey | null = null;
  for (const issue of error.issues) {
    const root = issue.path[0];
    if (root === "name" && isNameErrorKey(issue.message)) {
      name = issue.message;
      continue;
    }
    if (root === "phone" && issue.message === "contact") {
      contact = "required";
      continue;
    }
    if (root === "phone" && isLengthErrorKey(issue.message)) {
      phone = issue.message;
      continue;
    }
    if (root === "email" && isLengthErrorKey(issue.message)) {
      email = issue.message;
      continue;
    }
    if (root === "notes" && isLengthErrorKey(issue.message)) {
      notes = issue.message;
    }
  }
  return { name, phone, email, notes, contact };
}
