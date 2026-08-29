/**
 * Shared staff invite view (SHO-203 / feature SHO-201). Create returns this
 * plus a one-time plaintext `token` and copyable URL. List/get omit secrets.
 *
 * Mechanical caps copy CRM (`@showzy/validation/customers`): name 120,
 * phone 30, email 200. `status` on the wire is derived (`pending` |
 * `revoked` | `expired` | `exhausted`); the row stores only
 * `pending` | `revoked`. Company id and `token_hash` never appear.
 */
import {
  CUSTOMER_EMAIL_MAX,
  CUSTOMER_NAME_MAX,
  CUSTOMER_PHONE_MAX,
} from "@showzy/validation/customers";
import { z } from "zod";

export { CUSTOMER_EMAIL_MAX, CUSTOMER_NAME_MAX, CUSTOMER_PHONE_MAX };

export const INVITE_EXPIRES_MIN_MS = 60 * 60 * 1000;
export const INVITE_EXPIRES_MAX_MS = 365 * 24 * 60 * 60 * 1000;

export const inviteStoredStatusSchema = z.enum(["pending", "revoked"]);
export const inviteDerivedStatusSchema = z.enum([
  "pending",
  "revoked",
  "expired",
  "exhausted",
]);

export const inviteNameSchema = z
  .string()
  .trim()
  .max(CUSTOMER_NAME_MAX)
  .nullable()
  .optional();

export const invitePhoneSchema = z
  .string()
  .trim()
  .max(CUSTOMER_PHONE_MAX)
  .nullable()
  .optional();

export const inviteEmailSchema = z
  .string()
  .trim()
  .max(CUSTOMER_EMAIL_MAX)
  .nullable()
  .optional();

export const inviteAssignmentIdSchema = z.uuid().nullable().optional();

export const inviteViewSchema = z.object({
  id: z.uuid(),
  isReusable: z.boolean(),
  maxUses: z.number().int().min(1).nullable(),
  usesCount: z.number().int().nonnegative(),
  expiresAt: z.iso.datetime(),
  status: inviteDerivedStatusSchema,
  groupId: z.uuid().nullable(),
  priceListId: z.uuid().nullable(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  invitedBy: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type InviteView = z.output<typeof inviteViewSchema>;
export type InviteDerivedStatus = z.output<typeof inviteDerivedStatusSchema>;
export type InviteStoredStatus = z.output<typeof inviteStoredStatusSchema>;
