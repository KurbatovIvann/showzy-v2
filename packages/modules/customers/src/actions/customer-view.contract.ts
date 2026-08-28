/**
 * Shared CRM customer view (SHO-173 / customers-T3). Create, update, and
 * later get/list import this shape so T6 does not invent a second
 * projection. Mechanical caps the feature card named: name 120, phone 30,
 * email 200, notes 2000. `userId` is a better-auth text id (not uuid);
 * 128 is a mechanical wire ceiling, not a product rule.
 *
 * No `companyId` — catalog write views also omit tenant id.
 */
import { z } from "zod";

export const CUSTOMER_NAME_MAX = 120;
export const CUSTOMER_PHONE_MAX = 30;
export const CUSTOMER_EMAIL_MAX = 200;
export const CUSTOMER_NOTES_MAX = 2000;
export const CUSTOMER_USER_ID_MAX = 128;

export const CONTACT_REQUIRED_MESSAGE =
  "Provide at least one of phone, email, or userId.";

export const customerStatusSchema = z.enum(["active", "archived"]);

export const customerNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Name must not be blank." })
  .max(CUSTOMER_NAME_MAX);

export const customerPhoneSchema = z
  .string()
  .trim()
  .max(CUSTOMER_PHONE_MAX)
  .nullable()
  .optional();

export const customerEmailSchema = z
  .string()
  .trim()
  .max(CUSTOMER_EMAIL_MAX)
  .nullable()
  .optional();

export const customerUserIdSchema = z
  .string()
  .trim()
  .max(CUSTOMER_USER_ID_MAX)
  .nullable()
  .optional();

export const customerNotesSchema = z
  .string()
  .trim()
  .max(CUSTOMER_NOTES_MAX)
  .nullable()
  .optional();

export const customerAssignmentIdSchema = z.uuid().nullable().optional();

export type CustomerContactFields = {
  readonly phone?: string | null | undefined;
  readonly email?: string | null | undefined;
  readonly userId?: string | null | undefined;
};

function isPresentContact(value: string | null | undefined): boolean {
  return value !== undefined && value !== null && value.length > 0;
}

export function hasCustomerContact(value: CustomerContactFields): boolean {
  return (
    isPresentContact(value.phone) ||
    isPresentContact(value.email) ||
    isPresentContact(value.userId)
  );
}

export const customerViewSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  userId: z.string().nullable(),
  notes: z.string().nullable(),
  groupId: z.uuid().nullable(),
  priceListId: z.uuid().nullable(),
  status: customerStatusSchema,
  linkedCounterpartyCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
