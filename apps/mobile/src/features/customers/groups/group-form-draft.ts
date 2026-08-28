/**
 * Group form draft, snapshot, and dirty detection (SHO-181).
 * UI Zod lives in `group-form.schema.ts`; write planning is
 * `group-form-plan.ts`.
 */
import type { GetGroupOutput } from "../api/group-detail-query";
import {
  emptyFieldErrors,
  fieldErrorsFromDraftSchema,
  groupFormDraftSchema,
  type GroupFormFieldErrors,
} from "./group-form.schema";

export {
  emptyFieldErrors,
  type GroupFormFieldErrors,
  type LengthErrorKey,
  type NameErrorKey,
} from "./group-form.schema";

export type GroupFormMode = "create" | "edit";

export type GroupFormDraft = {
  name: string;
  description: string;
  priceListId: string | null;
};

export type GroupFormSnapshot = {
  readonly name: string;
  readonly description: string | null;
  readonly priceListId: string | null;
};

export function emptyGroupFormDraft(): GroupFormDraft {
  return {
    name: "",
    description: "",
    priceListId: null,
  };
}

export function cloneGroupFormDraft(values: GroupFormDraft): GroupFormDraft {
  return {
    name: values.name,
    description: values.description,
    priceListId: values.priceListId,
  };
}

function textOrEmpty(value: string | null): string {
  return value ?? "";
}

export function draftFromGroup(group: GetGroupOutput): GroupFormDraft {
  return {
    name: group.name,
    description: textOrEmpty(group.description),
    priceListId: group.priceListId,
  };
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function snapshotFromGroup(group: GetGroupOutput): GroupFormSnapshot {
  return {
    name: group.name.trim(),
    description: group.description,
    priceListId: group.priceListId,
  };
}

export function isGroupFormDirty(
  draft: GroupFormDraft,
  origin: GroupFormDraft,
): boolean {
  return (
    draft.name !== origin.name ||
    draft.description !== origin.description ||
    draft.priceListId !== origin.priceListId
  );
}

export function groupFormFieldChanged(
  mode: GroupFormMode,
  current: string | null,
  origin: string | null,
): boolean {
  return mode === "edit" && current !== origin;
}

export function validateGroupForm(draft: GroupFormDraft): GroupFormFieldErrors {
  const parsed = groupFormDraftSchema.safeParse(draft);
  if (parsed.success) {
    return emptyFieldErrors();
  }
  return fieldErrorsFromDraftSchema(parsed.error);
}

export function isGroupFormValid(errors: GroupFormFieldErrors): boolean {
  return errors.name === null && errors.description === null;
}

export type GroupFormUiParse =
  | { readonly ok: true; readonly draft: GroupFormDraft }
  | { readonly ok: false; readonly errors: GroupFormFieldErrors };

export function parseGroupFormUiDraft(draft: GroupFormDraft): GroupFormUiParse {
  const errors = validateGroupForm(draft);
  if (!isGroupFormValid(errors)) {
    return { ok: false, errors };
  }
  return { ok: true, draft };
}

export function snapshotFromDraft(
  draft: GroupFormDraft,
): GroupFormSnapshot | null {
  const errors = validateGroupForm(draft);
  if (!isGroupFormValid(errors)) {
    return null;
  }
  return {
    name: draft.name.trim(),
    description: emptyToNull(draft.description),
    priceListId: draft.priceListId,
  };
}
