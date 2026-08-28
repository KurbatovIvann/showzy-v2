/**
 * Customer form write planner (SHO-180). UI parse happens first via
 * `parseCustomerFormUiDraft`; this file turns a valid draft into one
 * create or update write.
 */
import type { WireErrorCode } from "@showzy/contract";

import type { ContractClient } from "../../../api/client";
import type { QueryFailureKind } from "../../../api/errors";
import {
  emptyToNull,
  isCustomerFormValid,
  parseCustomerFormUiDraft,
  snapshotFromDraft,
  validateCustomerForm,
  type CustomerFormDraft,
  type CustomerFormFieldErrors,
  type CustomerFormMode,
  type CustomerFormSnapshot,
} from "./customer-form-draft";

type CustomersClient = ContractClient["client"]["customers"];
export type CreateCustomerPayload = Parameters<
  CustomersClient["createCustomer"]
>[0];
export type UpdateCustomerPayload = Parameters<
  CustomersClient["updateCustomer"]
>[0];

export type CustomerFormWrite =
  | { readonly kind: "createCustomer"; readonly input: CreateCustomerPayload }
  | { readonly kind: "updateCustomer"; readonly input: UpdateCustomerPayload };

export type CustomerFormSavePlan =
  | { readonly kind: "invalid"; readonly errors: CustomerFormFieldErrors }
  | { readonly kind: "retry" }
  | { readonly kind: "noop" }
  | { readonly kind: "write"; readonly write: CustomerFormWrite };

export type CustomerFormMutationResult = {
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

function assignmentFields(draft: CustomerFormDraft): {
  readonly groupId: string | null;
  readonly priceListId: string | null;
} {
  return {
    groupId: draft.groupId,
    priceListId: draft.priceListId,
  };
}

function contactFields(draft: CustomerFormDraft): {
  readonly phone: string | null;
  readonly email: string | null;
  readonly notes: string | null;
} {
  return {
    phone: emptyToNull(draft.phone),
    email: emptyToNull(draft.email),
    notes: emptyToNull(draft.notes),
  };
}

export function createCustomerPayload(
  draft: CustomerFormDraft,
): CreateCustomerPayload | null {
  const snapshot = snapshotFromDraft(draft);
  if (snapshot === null) {
    return null;
  }
  return {
    name: snapshot.name,
    ...contactFields(draft),
    ...assignmentFields(draft),
  };
}

export function updateCustomerPayload(
  customerId: string,
  draft: CustomerFormDraft,
): UpdateCustomerPayload | null {
  const snapshot = snapshotFromDraft(draft);
  if (snapshot === null) {
    return null;
  }
  return {
    id: customerId,
    name: snapshot.name,
    ...contactFields(draft),
    userId: snapshot.userId,
    ...assignmentFields(draft),
  };
}

export function writesEqual(
  left: CustomerFormWrite,
  right: CustomerFormWrite,
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  return JSON.stringify(left.input) === JSON.stringify(right.input);
}

export function isCustomerFormRetryable(
  kind: QueryFailureKind | null,
  wireCode: WireErrorCode | null = null,
): boolean {
  if (wireCode !== null && RETRYABLE_WIRE.has(wireCode)) {
    return true;
  }
  return kind !== null && RETRYABLE_FAILURE.has(kind);
}

export function planCustomerFormSave(args: {
  readonly mode: CustomerFormMode;
  readonly customerId: string | null;
  readonly draft: CustomerFormDraft;
  readonly baseline: CustomerFormSnapshot | null;
  readonly lastWrite: CustomerFormWrite | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly lastWireCode?: WireErrorCode | null;
}): CustomerFormSavePlan {
  const errors = validateCustomerForm(args.draft);
  if (!isCustomerFormValid(errors)) {
    return { kind: "invalid", errors };
  }
  const retryable = isCustomerFormRetryable(
    args.lastFailureKind,
    args.lastWireCode ?? null,
  );
  if (args.mode === "create") {
    const input = createCustomerPayload(args.draft);
    if (input === null) {
      return { kind: "invalid", errors };
    }
    const write: CustomerFormWrite = { kind: "createCustomer", input };
    if (
      args.lastWrite !== null &&
      writesEqual(args.lastWrite, write) &&
      retryable
    ) {
      return { kind: "retry" };
    }
    return { kind: "write", write };
  }
  if (args.customerId === null || args.baseline === null) {
    return { kind: "invalid", errors };
  }
  const snapshot = snapshotFromDraft(args.draft);
  if (snapshot === null) {
    return { kind: "invalid", errors };
  }
  if (
    snapshot.name === args.baseline.name &&
    snapshot.phone === args.baseline.phone &&
    snapshot.email === args.baseline.email &&
    snapshot.notes === args.baseline.notes &&
    snapshot.groupId === args.baseline.groupId &&
    snapshot.priceListId === args.baseline.priceListId &&
    snapshot.userId === args.baseline.userId
  ) {
    return { kind: "noop" };
  }
  const input = updateCustomerPayload(args.customerId, args.draft);
  if (input === null) {
    return { kind: "invalid", errors };
  }
  const write: CustomerFormWrite = { kind: "updateCustomer", input };
  if (
    args.lastWrite !== null &&
    writesEqual(args.lastWrite, write) &&
    retryable
  ) {
    return { kind: "retry" };
  }
  return { kind: "write", write };
}

export function parseThenPlanCustomerFormSave(args: {
  readonly mode: CustomerFormMode;
  readonly customerId: string | null;
  readonly draft: CustomerFormDraft;
  readonly baseline: CustomerFormSnapshot | null;
  readonly lastWrite: CustomerFormWrite | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly lastWireCode?: WireErrorCode | null;
}): CustomerFormSavePlan {
  const parsed = parseCustomerFormUiDraft(args.draft);
  if (!parsed.ok) {
    return { kind: "invalid", errors: parsed.errors };
  }
  return planCustomerFormSave({ ...args, draft: parsed.draft });
}

export function applyWriteSuccess(args: {
  readonly draft: CustomerFormDraft;
  readonly write: CustomerFormWrite;
}): {
  readonly draft: CustomerFormDraft;
  readonly baseline: CustomerFormSnapshot | null;
  readonly done: boolean;
} {
  return {
    draft: args.draft,
    baseline: snapshotFromDraft(args.draft),
    done: true,
  };
}
