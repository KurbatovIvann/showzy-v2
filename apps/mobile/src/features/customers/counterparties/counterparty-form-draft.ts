/**
 * Counterparty form draft, snapshot, and dirty detection (SHO-196).
 * UI Zod lives in `counterparty-form.schema.ts`; write planning is
 * `counterparty-form-plan.ts`.
 */
import type { GetCounterpartyOutput } from "../api/counterparty-detail-query";
import {
  counterpartyFormDraftSchema,
  emptyFieldErrors,
  fieldErrorsFromDraftSchema,
  type CounterpartyFormFieldErrors,
} from "./counterparty-form.schema";

export {
  emptyFieldErrors,
  type CounterpartyFormFieldErrors,
  type CounterpartyLengthField,
  type LengthErrorKey,
  type NameErrorKey,
} from "./counterparty-form.schema";

export type CounterpartyFormMode = "create" | "edit";

export type CounterpartyFormDraft = {
  name: string;
  edrpou: string;
  legalAddress: string;
  iban: string;
  bankName: string;
  bankMfo: string;
  phone: string;
  email: string;
  notes: string;
  customerId: string | null;
};

export type CounterpartyFormSnapshot = {
  readonly name: string;
  readonly edrpou: string | null;
  readonly legalAddress: string | null;
  readonly iban: string | null;
  readonly bankName: string | null;
  readonly bankMfo: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly notes: string | null;
  readonly customerId: string | null;
};

export function emptyCounterpartyFormDraft(
  customerId: string | null = null,
): CounterpartyFormDraft {
  return {
    name: "",
    edrpou: "",
    legalAddress: "",
    iban: "",
    bankName: "",
    bankMfo: "",
    phone: "",
    email: "",
    notes: "",
    customerId,
  };
}

export function cloneCounterpartyFormDraft(
  values: CounterpartyFormDraft,
): CounterpartyFormDraft {
  return {
    name: values.name,
    edrpou: values.edrpou,
    legalAddress: values.legalAddress,
    iban: values.iban,
    bankName: values.bankName,
    bankMfo: values.bankMfo,
    phone: values.phone,
    email: values.email,
    notes: values.notes,
    customerId: values.customerId,
  };
}

function textOrEmpty(value: string | null): string {
  return value ?? "";
}

export function draftFromCounterparty(
  counterparty: GetCounterpartyOutput,
): CounterpartyFormDraft {
  return {
    name: counterparty.name,
    edrpou: textOrEmpty(counterparty.edrpou),
    legalAddress: textOrEmpty(counterparty.legalAddress),
    iban: textOrEmpty(counterparty.iban),
    bankName: textOrEmpty(counterparty.bankName),
    bankMfo: textOrEmpty(counterparty.bankMfo),
    phone: textOrEmpty(counterparty.phone),
    email: textOrEmpty(counterparty.email),
    notes: textOrEmpty(counterparty.notes),
    customerId: counterparty.customerId,
  };
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function snapshotFromCounterparty(
  counterparty: GetCounterpartyOutput,
): CounterpartyFormSnapshot {
  return {
    name: counterparty.name.trim(),
    edrpou: counterparty.edrpou,
    legalAddress: counterparty.legalAddress,
    iban: counterparty.iban,
    bankName: counterparty.bankName,
    bankMfo: counterparty.bankMfo,
    phone: counterparty.phone,
    email: counterparty.email,
    notes: counterparty.notes,
    customerId: counterparty.customerId,
  };
}

export function isCounterpartyFormDirty(
  draft: CounterpartyFormDraft,
  origin: CounterpartyFormDraft,
): boolean {
  return (
    draft.name !== origin.name ||
    draft.edrpou !== origin.edrpou ||
    draft.legalAddress !== origin.legalAddress ||
    draft.iban !== origin.iban ||
    draft.bankName !== origin.bankName ||
    draft.bankMfo !== origin.bankMfo ||
    draft.phone !== origin.phone ||
    draft.email !== origin.email ||
    draft.notes !== origin.notes ||
    draft.customerId !== origin.customerId
  );
}

export function counterpartyFormFieldChanged(
  mode: CounterpartyFormMode,
  current: string | null,
  origin: string | null,
): boolean {
  return mode === "edit" && current !== origin;
}

export function validateCounterpartyForm(
  draft: CounterpartyFormDraft,
): CounterpartyFormFieldErrors {
  const parsed = counterpartyFormDraftSchema.safeParse(draft);
  if (parsed.success) {
    return emptyFieldErrors();
  }
  return fieldErrorsFromDraftSchema(parsed.error);
}

export function isCounterpartyFormValid(
  errors: CounterpartyFormFieldErrors,
): boolean {
  return (
    errors.name === null &&
    errors.edrpou === null &&
    errors.legalAddress === null &&
    errors.iban === null &&
    errors.bankName === null &&
    errors.bankMfo === null &&
    errors.phone === null &&
    errors.email === null &&
    errors.notes === null
  );
}

export type CounterpartyFormUiParse =
  | { readonly ok: true; readonly draft: CounterpartyFormDraft }
  | { readonly ok: false; readonly errors: CounterpartyFormFieldErrors };

export function parseCounterpartyFormUiDraft(
  draft: CounterpartyFormDraft,
): CounterpartyFormUiParse {
  const errors = validateCounterpartyForm(draft);
  if (!isCounterpartyFormValid(errors)) {
    return { ok: false, errors };
  }
  return { ok: true, draft };
}

export function snapshotFromDraft(
  draft: CounterpartyFormDraft,
): CounterpartyFormSnapshot | null {
  const errors = validateCounterpartyForm(draft);
  if (!isCounterpartyFormValid(errors)) {
    return null;
  }
  return {
    name: draft.name.trim(),
    edrpou: emptyToNull(draft.edrpou),
    legalAddress: emptyToNull(draft.legalAddress),
    iban: emptyToNull(draft.iban),
    bankName: emptyToNull(draft.bankName),
    bankMfo: emptyToNull(draft.bankMfo),
    phone: emptyToNull(draft.phone),
    email: emptyToNull(draft.email),
    notes: emptyToNull(draft.notes),
    customerId: draft.customerId,
  };
}
