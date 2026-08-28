/**
 * Group form write planner (SHO-181). UI parse happens first via
 * `parseGroupFormUiDraft`; this file turns a valid draft into one
 * create or update write.
 */
import type { WireErrorCode } from "@showzy/contract";

import type { ContractClient } from "../../../api/client";
import type { QueryFailureKind } from "../../../api/errors";
import {
  isGroupFormValid,
  parseGroupFormUiDraft,
  snapshotFromDraft,
  validateGroupForm,
  type GroupFormDraft,
  type GroupFormFieldErrors,
  type GroupFormMode,
  type GroupFormSnapshot,
} from "./group-form-draft";

type CustomersClient = ContractClient["client"]["customers"];
export type CreateGroupPayload = Parameters<CustomersClient["createGroup"]>[0];
export type UpdateGroupPayload = Parameters<CustomersClient["updateGroup"]>[0];

export type GroupFormWrite =
  | { readonly kind: "createGroup"; readonly input: CreateGroupPayload }
  | { readonly kind: "updateGroup"; readonly input: UpdateGroupPayload };

export type GroupFormSavePlan =
  | { readonly kind: "invalid"; readonly errors: GroupFormFieldErrors }
  | { readonly kind: "retry" }
  | { readonly kind: "noop" }
  | { readonly kind: "write"; readonly write: GroupFormWrite };

export type GroupFormMutationResult = {
  readonly id: string;
};

const RETRYABLE_FAILURE: ReadonlySet<QueryFailureKind> = new Set([
  "network",
  "offline",
  "timeout",
  "rate_limited",
  "internal",
]);

const RETRYABLE_WIRE: ReadonlySet<WireErrorCode> = new Set([
  "RETRY_IN_PROGRESS",
  "IDEMPOTENCY_CONFLICT",
]);

function descriptionField(draft: GroupFormDraft): string {
  return draft.description.trim();
}

export function createGroupPayload(
  draft: GroupFormDraft,
): CreateGroupPayload | null {
  const snapshot = snapshotFromDraft(draft);
  if (snapshot === null) {
    return null;
  }
  return {
    name: snapshot.name,
    description: descriptionField(draft),
    priceListId: snapshot.priceListId,
  };
}

export function updateGroupPayload(
  groupId: string,
  draft: GroupFormDraft,
): UpdateGroupPayload | null {
  const snapshot = snapshotFromDraft(draft);
  if (snapshot === null) {
    return null;
  }
  return {
    id: groupId,
    name: snapshot.name,
    description: descriptionField(draft),
    priceListId: snapshot.priceListId,
  };
}

export function writesEqual(
  left: GroupFormWrite,
  right: GroupFormWrite,
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  return JSON.stringify(left.input) === JSON.stringify(right.input);
}

export function isGroupFormRetryable(
  kind: QueryFailureKind | null,
  wireCode: WireErrorCode | null = null,
): boolean {
  if (wireCode !== null && RETRYABLE_WIRE.has(wireCode)) {
    return true;
  }
  return kind !== null && RETRYABLE_FAILURE.has(kind);
}

export function planGroupFormSave(args: {
  readonly mode: GroupFormMode;
  readonly groupId: string | null;
  readonly draft: GroupFormDraft;
  readonly baseline: GroupFormSnapshot | null;
  readonly lastWrite: GroupFormWrite | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly lastWireCode?: WireErrorCode | null;
}): GroupFormSavePlan {
  const errors = validateGroupForm(args.draft);
  if (!isGroupFormValid(errors)) {
    return { kind: "invalid", errors };
  }
  const retryable = isGroupFormRetryable(
    args.lastFailureKind,
    args.lastWireCode ?? null,
  );
  if (args.mode === "create") {
    const input = createGroupPayload(args.draft);
    if (input === null) {
      return { kind: "invalid", errors };
    }
    const write: GroupFormWrite = { kind: "createGroup", input };
    if (
      args.lastWrite !== null &&
      writesEqual(args.lastWrite, write) &&
      retryable
    ) {
      return { kind: "retry" };
    }
    return { kind: "write", write };
  }
  if (args.groupId === null || args.baseline === null) {
    return { kind: "invalid", errors };
  }
  const snapshot = snapshotFromDraft(args.draft);
  if (snapshot === null) {
    return { kind: "invalid", errors };
  }
  if (
    snapshot.name === args.baseline.name &&
    snapshot.description === args.baseline.description &&
    snapshot.priceListId === args.baseline.priceListId
  ) {
    return { kind: "noop" };
  }
  const input = updateGroupPayload(args.groupId, args.draft);
  if (input === null) {
    return { kind: "invalid", errors };
  }
  const write: GroupFormWrite = { kind: "updateGroup", input };
  if (
    args.lastWrite !== null &&
    writesEqual(args.lastWrite, write) &&
    retryable
  ) {
    return { kind: "retry" };
  }
  return { kind: "write", write };
}

export function parseThenPlanGroupFormSave(args: {
  readonly mode: GroupFormMode;
  readonly groupId: string | null;
  readonly draft: GroupFormDraft;
  readonly baseline: GroupFormSnapshot | null;
  readonly lastWrite: GroupFormWrite | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly lastWireCode?: WireErrorCode | null;
}): GroupFormSavePlan {
  const parsed = parseGroupFormUiDraft(args.draft);
  if (!parsed.ok) {
    return { kind: "invalid", errors: parsed.errors };
  }
  return planGroupFormSave({ ...args, draft: parsed.draft });
}

export function applyWriteSuccess(args: {
  readonly draft: GroupFormDraft;
  readonly write: GroupFormWrite;
}): {
  readonly draft: GroupFormDraft;
  readonly baseline: GroupFormSnapshot | null;
  readonly done: boolean;
} {
  return {
    draft: args.draft,
    baseline: snapshotFromDraft(args.draft),
    done: true,
  };
}
