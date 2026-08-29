/**
 * UI draft Zod for the invitation create form (SHO-206). Caps from
 * `@showzy/validation/customers`. Range constants match
 * `invite-view.contract.ts` (min now+1h, max now+365d). Schema
 * `message` values are keys, never user-facing copy. This is not the
 * invites action wire schema.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CUSTOMER_EMAIL_MAX,
  CUSTOMER_NAME_MAX,
  CUSTOMER_PHONE_MAX,
} from "@showzy/validation/customers";
import { z } from "zod";

export { CUSTOMER_EMAIL_MAX, CUSTOMER_NAME_MAX, CUSTOMER_PHONE_MAX };

/** Same window as `INVITE_EXPIRES_MIN_MS` on the create contract. */
export const INVITE_EXPIRES_MIN_MS = 60 * 60 * 1000;
/** Same window as `INVITE_EXPIRES_MAX_MS` on the create contract. */
export const INVITE_EXPIRES_MAX_MS = 365 * 24 * 60 * 60 * 1000;
/** Owner decision 4: UI default 7 days from now. */
export const INVITE_EXPIRES_DEFAULT_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * Picker/submit min clamp sits this far above `now+MIN` so an ISO that
 * was valid at picker close still passes UI Zod and `invites.create`
 * after picker→Create→server `Date.now()` (all `>= now+MIN`).
 */
export const INVITE_EXPIRES_MIN_CLAMP_SLACK_MS = 60 * 1000;

export type InvitationKind = "personal" | "reusable";

export type LengthErrorKey = "too_long";
export type ExpiresErrorKey = "invalid" | "range";
export type MaxUsesErrorKey = "invalid";

export type InvitationFormFieldErrors = {
  readonly name: LengthErrorKey | null;
  readonly phone: LengthErrorKey | null;
  readonly email: LengthErrorKey | null;
  readonly expiresAt: ExpiresErrorKey | null;
  readonly maxUses: MaxUsesErrorKey | null;
};

export function emptyFieldErrors(): InvitationFormFieldErrors {
  return {
    name: null,
    phone: null,
    email: null,
    expiresAt: null,
    maxUses: null,
  };
}

export function isLengthErrorKey(value: string): value is LengthErrorKey {
  return value === "too_long";
}

export function isExpiresErrorKey(value: string): value is ExpiresErrorKey {
  return value === "invalid" || value === "range";
}

export function isMaxUsesErrorKey(value: string): value is MaxUsesErrorKey {
  return value === "invalid";
}

function cappedOptional(max: number) {
  return z.string().refine((value) => value.trim().length <= max, {
    message: "too_long",
  });
}

export function parseInviteMaxUsesInput(
  value: string,
): number | null | "invalid" {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!/^[0-9]+$/.test(trimmed)) {
    return "invalid";
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return "invalid";
  }
  return parsed;
}

export function expiresAtMs(value: string): number | null {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

export function expiresAtInRange(value: string, nowMs: number): boolean {
  const expiresMs = expiresAtMs(value);
  if (expiresMs === null) {
    return false;
  }
  return (
    expiresMs >= nowMs + INVITE_EXPIRES_MIN_MS &&
    expiresMs <= nowMs + INVITE_EXPIRES_MAX_MS
  );
}

export const invitationFormDraftSchema = z
  .object({
    kind: z.enum(["personal", "reusable"]),
    name: cappedOptional(CUSTOMER_NAME_MAX),
    phone: cappedOptional(CUSTOMER_PHONE_MAX),
    email: cappedOptional(CUSTOMER_EMAIL_MAX),
    groupId: z.uuid().nullable(),
    priceListId: z.uuid().nullable(),
    maxUses: z.string(),
    expiresAt: z.string(),
  })
  .superRefine((value, ctx) => {
    const expiresMs = expiresAtMs(value.expiresAt);
    if (expiresMs === null) {
      ctx.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "invalid",
      });
    } else if (!expiresAtInRange(value.expiresAt, Date.now())) {
      ctx.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "range",
      });
    }
    if (value.kind === "reusable") {
      const parsed = parseInviteMaxUsesInput(value.maxUses);
      if (parsed === "invalid") {
        ctx.addIssue({
          code: "custom",
          path: ["maxUses"],
          message: "invalid",
        });
      }
    }
  });

export const invitationFormResolver = zodResolver(invitationFormDraftSchema);

/**
 * Map UI-schema issues onto field copy keys. The schema `message` values
 * are keys (`too_long` / `invalid` / `range`), never user-facing copy.
 */
export function fieldErrorsFromDraftSchema(
  error: z.ZodError,
): InvitationFormFieldErrors {
  let name: LengthErrorKey | null = null;
  let phone: LengthErrorKey | null = null;
  let email: LengthErrorKey | null = null;
  let expiresAt: ExpiresErrorKey | null = null;
  let maxUses: MaxUsesErrorKey | null = null;
  for (const issue of error.issues) {
    const root = issue.path[0];
    if (root === "name" && isLengthErrorKey(issue.message)) {
      name = issue.message;
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
    if (root === "expiresAt" && isExpiresErrorKey(issue.message)) {
      expiresAt = issue.message;
      continue;
    }
    if (root === "maxUses" && isMaxUsesErrorKey(issue.message)) {
      maxUses = issue.message;
    }
  }
  return { name, phone, email, expiresAt, maxUses };
}
