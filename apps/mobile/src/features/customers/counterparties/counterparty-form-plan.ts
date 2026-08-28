/**
 * Counterparty form write planner (SHO-196). UI parse happens first via
 * `parseCounterpartyFormUiDraft`; this file turns a valid draft into one
 * create or update write. Empty optional strings become null. Null
 * `customerId` is standalone (update null unlinks).
 */
import type { WireErrorCode } from "@showzy/contract";

import type { ContractClient } from "../../../api/client";
import type { QueryFailureKind } from "../../../api/errors";
import {
  emptyToNull,
  isCounterpartyFormValid,
  parseCounterpartyFormUiDraft,
  snapshotFromDraft,
  validateCounterpartyForm,
  type CounterpartyFormDraft,
  type CounterpartyFormFieldErrors,
  type CounterpartyFormMode,
  type CounterpartyFormSnapshot,
} from "./counterparty-form-draft";

type CustomersClient = ContractClient["client"]["customers"];
export type CreateCounterpartyPayload = Parameters<
  CustomersClient["createCounterparty"]
>[0];
export type UpdateCounterpartyPayload = Parameters<
  CustomersClient["updateCounterparty"]
>[0];

export type CounterpartyFormWrite =
  | {
      readonly kind: "createCounterparty";
      readonly input: CreateCounterpartyPayload;
    }
  | {
      readonly kind: "updateCounterparty";
      readonly input: UpdateCounterpartyPayload;
    };

export type CounterpartyFormSavePlan =
  | { readonly kind: "invalid"; readonly errors: CounterpartyFormFieldErrors }
  | { readonly kind: "retry" }
  | { readonly kind: "noop" }
  | { readonly kind: "write"; readonly write: CounterpartyFormWrite };

export type CounterpartyFormMutationResult = {
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

function optionalFields(draft: CounterpartyFormDraft): {
  readonly edrpou: string | null;
  readonly legalAddress: string | null;
  readonly iban: string | null;
  readonly bankName: string | null;
  readonly bankMfo: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly notes: string | null;
  readonly customerId: string | null;
} {
  return {
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

export function createCounterpartyPayload(
  draft: CounterpartyFormDraft,
): CreateCounterpartyPayload | null {
  const snapshot = snapshotFromDraft(draft);
  if (snapshot === null) {
    return null;
  }
  return {
    name: snapshot.name,
    ...optionalFields(draft),
  };
}

export function updateCounterpartyPayload(
  counterpartyId: string,
  draft: CounterpartyFormDraft,
): UpdateCounterpartyPayload | null {
  const snapshot = snapshotFromDraft(draft);
  if (snapshot === null) {
    return null;
  }
  return {
    id: counterpartyId,
    name: snapshot.name,
    ...optionalFields(draft),
  };
}

export function writesEqual(
  left: CounterpartyFormWrite,
  right: CounterpartyFormWrite,
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  return JSON.stringify(left.input) === JSON.stringify(right.input);
}

export function isCounterpartyFormRetryable(
  kind: QueryFailureKind | null,
  wireCode: WireErrorCode | null = null,
): boolean {
  if (wireCode !== null && RETRYABLE_WIRE.has(wireCode)) {
    return true;
  }
  return kind !== null && RETRYABLE_FAILURE.has(kind);
}

function snapshotsEqual(
  left: CounterpartyFormSnapshot,
  right: CounterpartyFormSnapshot,
): boolean {
  return (
    left.name === right.name &&
    left.edrpou === right.edrpou &&
    left.legalAddress === right.legalAddress &&
    left.iban === right.iban &&
    left.bankName === right.bankName &&
    left.bankMfo === right.bankMfo &&
    left.phone === right.phone &&
    left.email === right.email &&
    left.notes === right.notes &&
    left.customerId === right.customerId
  );
}

export function planCounterpartyFormSave(args: {
  readonly mode: CounterpartyFormMode;
  readonly counterpartyId: string | null;
  readonly draft: CounterpartyFormDraft;
  readonly baseline: CounterpartyFormSnapshot | null;
  readonly lastWrite: CounterpartyFormWrite | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly lastWireCode?: WireErrorCode | null;
}): CounterpartyFormSavePlan {
  const errors = validateCounterpartyForm(args.draft);
  if (!isCounterpartyFormValid(errors)) {
    return { kind: "invalid", errors };
  }
  const retryable = isCounterpartyFormRetryable(
    args.lastFailureKind,
    args.lastWireCode ?? null,
  );
  if (args.mode === "create") {
    const input = createCounterpartyPayload(args.draft);
    if (input === null) {
      return { kind: "invalid", errors };
    }
    const write: CounterpartyFormWrite = {
      kind: "createCounterparty",
      input,
    };
    if (
      args.lastWrite !== null &&
      writesEqual(args.lastWrite, write) &&
      retryable
    ) {
      return { kind: "retry" };
    }
    return { kind: "write", write };
  }
  if (args.counterpartyId === null || args.baseline === null) {
    return { kind: "invalid", errors };
  }
  const snapshot = snapshotFromDraft(args.draft);
  if (snapshot === null) {
    return { kind: "invalid", errors };
  }
  if (snapshotsEqual(snapshot, args.baseline)) {
    return { kind: "noop" };
  }
  const input = updateCounterpartyPayload(args.counterpartyId, args.draft);
  if (input === null) {
    return { kind: "invalid", errors };
  }
  const write: CounterpartyFormWrite = {
    kind: "updateCounterparty",
    input,
  };
  if (
    args.lastWrite !== null &&
    writesEqual(args.lastWrite, write) &&
    retryable
  ) {
    return { kind: "retry" };
  }
  return { kind: "write", write };
}

export function parseThenPlanCounterpartyFormSave(args: {
  readonly mode: CounterpartyFormMode;
  readonly counterpartyId: string | null;
  readonly draft: CounterpartyFormDraft;
  readonly baseline: CounterpartyFormSnapshot | null;
  readonly lastWrite: CounterpartyFormWrite | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly lastWireCode?: WireErrorCode | null;
}): CounterpartyFormSavePlan {
  const parsed = parseCounterpartyFormUiDraft(args.draft);
  if (!parsed.ok) {
    return { kind: "invalid", errors: parsed.errors };
  }
  return planCounterpartyFormSave({ ...args, draft: parsed.draft });
}

export function applyWriteSuccess(args: {
  readonly draft: CounterpartyFormDraft;
  readonly write: CounterpartyFormWrite;
}): {
  readonly draft: CounterpartyFormDraft;
  readonly baseline: CounterpartyFormSnapshot | null;
  readonly done: boolean;
} {
  return {
    draft: args.draft,
    baseline: snapshotFromDraft(args.draft),
    done: true,
  };
}
