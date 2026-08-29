/**
 * Invitation create draft, snapshot, and dirty detection (SHO-206).
 * UI Zod lives in `invitation-form.schema.ts`; write planning is
 * `invitation-form-plan.ts`.
 */
import {
  clampInviteExpiresAt,
  emptyFieldErrors,
  expiresAtInRange,
  expiresAtMs,
  fieldErrorsFromDraftSchema,
  invitationFormDraftSchema,
  INVITE_EXPIRES_DEFAULT_MS,
  parseInviteMaxUsesInput,
  type InvitationFormFieldErrors,
  type InvitationKind,
} from "./invitation-form.schema";

export {
  clampInviteExpiresAt,
  emptyFieldErrors,
  type ExpiresErrorKey,
  type InvitationFormFieldErrors,
  type InvitationKind,
  type LengthErrorKey,
  type MaxUsesErrorKey,
} from "./invitation-form.schema";

export type InvitationFormDraft = {
  kind: InvitationKind;
  name: string;
  phone: string;
  email: string;
  groupId: string | null;
  priceListId: string | null;
  maxUses: string;
  expiresAt: string;
};

export type InvitationFormSnapshot = {
  readonly isReusable: boolean;
  readonly expiresAt: string;
  readonly maxUses: number | null;
  readonly groupId: string | null;
  readonly priceListId: string | null;
  readonly name: string | null;
  readonly phone: string | null;
  readonly email: string | null;
};

export function defaultInviteExpiresAt(nowMs: number): string {
  return new Date(nowMs + INVITE_EXPIRES_DEFAULT_MS).toISOString();
}

export function emptyInvitationFormDraft(
  nowMs: number = Date.now(),
): InvitationFormDraft {
  return {
    kind: "personal",
    name: "",
    phone: "",
    email: "",
    groupId: null,
    priceListId: null,
    maxUses: "",
    expiresAt: defaultInviteExpiresAt(nowMs),
  };
}

export function cloneInvitationFormDraft(
  values: InvitationFormDraft,
): InvitationFormDraft {
  return {
    kind: values.kind,
    name: values.name,
    phone: values.phone,
    email: values.email,
    groupId: values.groupId,
    priceListId: values.priceListId,
    maxUses: values.maxUses,
    expiresAt: values.expiresAt,
  };
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Bump a draft `expiresAt` that has drifted out of the contract window
 * (picker clock vs submit/server `Date.now()`). In-range values are
 * left unchanged so a frozen draft still retries the same write.
 */
export function reclampInvitationDraftExpiresAt(
  draft: InvitationFormDraft,
  nowMs: number = Date.now(),
): InvitationFormDraft {
  if (expiresAtInRange(draft.expiresAt, nowMs)) {
    return draft;
  }
  const expiresMs = expiresAtMs(draft.expiresAt);
  if (expiresMs === null) {
    return draft;
  }
  return {
    ...draft,
    expiresAt: clampInviteExpiresAt(expiresMs, nowMs),
  };
}

/**
 * Keep the draft's clock time and apply the picker's local calendar
 * date (canvas date field → native date picker), then reclamp into
 * `[now+MIN+slack, now+MAX]`. Slack on the floor so the ISO is not
 * exact min (picker close → Create → server parse all require
 * `expiresMs >= Date.now()+MIN`). Max stays the exact ceiling.
 */
export function applyInviteExpiresDate(
  iso: string,
  pickedLocalDate: Date,
  nowMs: number = Date.now(),
): string {
  const current = new Date(iso);
  const next = new Date(pickedLocalDate.getTime());
  if (Number.isFinite(current.getTime())) {
    next.setHours(
      current.getHours(),
      current.getMinutes(),
      current.getSeconds(),
      current.getMilliseconds(),
    );
  }
  return clampInviteExpiresAt(next.getTime(), nowMs);
}

export function isInvitationFormDirty(
  draft: InvitationFormDraft,
  origin: InvitationFormDraft,
): boolean {
  return (
    draft.kind !== origin.kind ||
    draft.name !== origin.name ||
    draft.phone !== origin.phone ||
    draft.email !== origin.email ||
    draft.groupId !== origin.groupId ||
    draft.priceListId !== origin.priceListId ||
    draft.maxUses !== origin.maxUses ||
    draft.expiresAt !== origin.expiresAt
  );
}

export function validateInvitationForm(
  draft: InvitationFormDraft,
): InvitationFormFieldErrors {
  const parsed = invitationFormDraftSchema.safeParse(draft);
  if (parsed.success) {
    return emptyFieldErrors();
  }
  return fieldErrorsFromDraftSchema(parsed.error);
}

export function isInvitationFormValid(
  errors: InvitationFormFieldErrors,
): boolean {
  return (
    errors.name === null &&
    errors.phone === null &&
    errors.email === null &&
    errors.expiresAt === null &&
    errors.maxUses === null
  );
}

export type InvitationFormUiParse =
  | { readonly ok: true; readonly draft: InvitationFormDraft }
  | { readonly ok: false; readonly errors: InvitationFormFieldErrors };

export function parseInvitationFormUiDraft(
  draft: InvitationFormDraft,
): InvitationFormUiParse {
  const errors = validateInvitationForm(draft);
  if (!isInvitationFormValid(errors)) {
    return { ok: false, errors };
  }
  return { ok: true, draft };
}

export function snapshotFromDraft(
  draft: InvitationFormDraft,
  nowMs: number = Date.now(),
): InvitationFormSnapshot | null {
  const next = reclampInvitationDraftExpiresAt(draft, nowMs);
  const errors = validateInvitationForm(next);
  if (!isInvitationFormValid(errors)) {
    return null;
  }
  const isReusable = next.kind === "reusable";
  const parsedMax = parseInviteMaxUsesInput(next.maxUses);
  return {
    isReusable,
    expiresAt: next.expiresAt,
    maxUses: isReusable && parsedMax !== "invalid" ? parsedMax : null,
    groupId: next.groupId,
    priceListId: next.priceListId,
    name: emptyToNull(next.name),
    phone: emptyToNull(next.phone),
    email: emptyToNull(next.email),
  };
}
