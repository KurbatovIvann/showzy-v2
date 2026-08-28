/**
 * Customer form draft, snapshot, and dirty detection (SHO-180).
 * UI Zod lives in `customer-form.schema.ts`; write planning is
 * `customer-form-plan.ts`.
 */
import type { GetCustomerOutput } from "../api/customer-detail-query";
import {
  emptyFieldErrors,
  fieldErrorsFromDraftSchema,
  customerFormDraftSchema,
  type CustomerFormFieldErrors,
} from "./customer-form.schema";

export {
  emptyFieldErrors,
  type ContactErrorKey,
  type CustomerFormFieldErrors,
  type LengthErrorKey,
  type NameErrorKey,
} from "./customer-form.schema";

export type CustomerFormMode = "create" | "edit";

export type CustomerFormDraft = {
  name: string;
  phone: string;
  email: string;
  notes: string;
  groupId: string | null;
  priceListId: string | null;
  userId: string | null;
};

export type CustomerFormSnapshot = {
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly notes: string | null;
  readonly groupId: string | null;
  readonly priceListId: string | null;
  readonly userId: string | null;
};

export function emptyCustomerFormDraft(): CustomerFormDraft {
  return {
    name: "",
    phone: "",
    email: "",
    notes: "",
    groupId: null,
    priceListId: null,
    userId: null,
  };
}

export function cloneCustomerFormDraft(
  values: CustomerFormDraft,
): CustomerFormDraft {
  return {
    name: values.name,
    phone: values.phone,
    email: values.email,
    notes: values.notes,
    groupId: values.groupId,
    priceListId: values.priceListId,
    userId: values.userId,
  };
}

function textOrEmpty(value: string | null): string {
  return value ?? "";
}

export function draftFromCustomer(
  customer: GetCustomerOutput,
): CustomerFormDraft {
  return {
    name: customer.name,
    phone: textOrEmpty(customer.phone),
    email: textOrEmpty(customer.email),
    notes: textOrEmpty(customer.notes),
    groupId: customer.groupId,
    priceListId: customer.priceListId,
    userId: customer.userId,
  };
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function snapshotFromCustomer(
  customer: GetCustomerOutput,
): CustomerFormSnapshot {
  return {
    name: customer.name.trim(),
    phone: customer.phone,
    email: customer.email,
    notes: customer.notes,
    groupId: customer.groupId,
    priceListId: customer.priceListId,
    userId: customer.userId,
  };
}

export function isCustomerFormDirty(
  draft: CustomerFormDraft,
  origin: CustomerFormDraft,
): boolean {
  return (
    draft.name !== origin.name ||
    draft.phone !== origin.phone ||
    draft.email !== origin.email ||
    draft.notes !== origin.notes ||
    draft.groupId !== origin.groupId ||
    draft.priceListId !== origin.priceListId ||
    draft.userId !== origin.userId
  );
}

export function customerFormFieldChanged(
  mode: CustomerFormMode,
  current: string | null,
  origin: string | null,
): boolean {
  return mode === "edit" && current !== origin;
}

export function validateCustomerForm(
  draft: CustomerFormDraft,
): CustomerFormFieldErrors {
  const parsed = customerFormDraftSchema.safeParse(draft);
  if (parsed.success) {
    return emptyFieldErrors();
  }
  return fieldErrorsFromDraftSchema(parsed.error);
}

export function isCustomerFormValid(
  errors: CustomerFormFieldErrors,
): boolean {
  return (
    errors.name === null &&
    errors.phone === null &&
    errors.email === null &&
    errors.notes === null &&
    errors.contact === null
  );
}

export type CustomerFormUiParse =
  | { readonly ok: true; readonly draft: CustomerFormDraft }
  | { readonly ok: false; readonly errors: CustomerFormFieldErrors };

export function parseCustomerFormUiDraft(
  draft: CustomerFormDraft,
): CustomerFormUiParse {
  const errors = validateCustomerForm(draft);
  if (!isCustomerFormValid(errors)) {
    return { ok: false, errors };
  }
  return { ok: true, draft };
}

export function snapshotFromDraft(
  draft: CustomerFormDraft,
): CustomerFormSnapshot | null {
  const errors = validateCustomerForm(draft);
  if (!isCustomerFormValid(errors)) {
    return null;
  }
  return {
    name: draft.name.trim(),
    phone: emptyToNull(draft.phone),
    email: emptyToNull(draft.email),
    notes: emptyToNull(draft.notes),
    groupId: draft.groupId,
    priceListId: draft.priceListId,
    userId: emptyToNull(draft.userId ?? ""),
  };
}
