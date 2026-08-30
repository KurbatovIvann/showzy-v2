/**
 * Document create write planner (SHO-238). UI parse happens first via
 * `parseDocumentFormUiDraft`; this file turns a valid draft into one
 * `documents.createFromOrder` write. Wire is
 * `{ orderId, type, counterpartyId? }` only — no money, template, city,
 * or customerId.
 */
import type { WireErrorCode } from "@showzy/contract";

import type { ContractClient } from "../../../api/client";
import type { QueryFailureKind } from "../../../api/errors";
import {
  isDocumentFormValid,
  parseDocumentFormUiDraft,
  validateDocumentForm,
  type DocumentFormDraft,
  type DocumentFormFieldErrors,
} from "./document-form-draft";

type DocumentsClient = ContractClient["client"]["documents"];
export type CreateFromOrderPayload = Parameters<
  DocumentsClient["createFromOrder"]
>[0];
export type CreateFromOrderResult = Awaited<
  ReturnType<DocumentsClient["createFromOrder"]>
>;

export type DocumentFormWrite = {
  readonly kind: "createFromOrder";
  readonly input: CreateFromOrderPayload;
};

export type DocumentFormSavePlan =
  | { readonly kind: "invalid"; readonly errors: DocumentFormFieldErrors }
  | { readonly kind: "retry" }
  | { readonly kind: "write"; readonly write: DocumentFormWrite };

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

export function createFromOrderPayload(
  draft: DocumentFormDraft,
): CreateFromOrderPayload | null {
  const parsed = parseDocumentFormUiDraft(draft);
  if (!parsed.ok) {
    return null;
  }
  if (parsed.draft.counterpartyId.length === 0) {
    return {
      orderId: parsed.draft.orderId,
      type: parsed.draft.type,
    };
  }
  return {
    orderId: parsed.draft.orderId,
    type: parsed.draft.type,
    counterpartyId: parsed.draft.counterpartyId,
  };
}

export function writesEqual(
  left: DocumentFormWrite,
  right: DocumentFormWrite,
): boolean {
  return JSON.stringify(left.input) === JSON.stringify(right.input);
}

export function isDocumentFormRetryable(
  kind: QueryFailureKind | null,
  wireCode: WireErrorCode | null = null,
): boolean {
  if (wireCode !== null && RETRYABLE_WIRE.has(wireCode)) {
    return true;
  }
  return kind !== null && RETRYABLE_FAILURE.has(kind);
}

export function planDocumentFormSave(args: {
  readonly draft: DocumentFormDraft;
  readonly lastWrite: DocumentFormWrite | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly lastWireCode?: WireErrorCode | null;
}): DocumentFormSavePlan {
  const errors = validateDocumentForm(args.draft);
  if (!isDocumentFormValid(errors)) {
    return { kind: "invalid", errors };
  }
  const input = createFromOrderPayload(args.draft);
  if (input === null) {
    return { kind: "invalid", errors };
  }
  const write: DocumentFormWrite = { kind: "createFromOrder", input };
  const retryable = isDocumentFormRetryable(
    args.lastFailureKind,
    args.lastWireCode ?? null,
  );
  if (
    args.lastWrite !== null &&
    writesEqual(args.lastWrite, write) &&
    retryable
  ) {
    return { kind: "retry" };
  }
  return { kind: "write", write };
}

export function parseThenPlanDocumentFormSave(args: {
  readonly draft: DocumentFormDraft;
  readonly lastWrite: DocumentFormWrite | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly lastWireCode?: WireErrorCode | null;
}): DocumentFormSavePlan {
  const parsed = parseDocumentFormUiDraft(args.draft);
  if (!parsed.ok) {
    return { kind: "invalid", errors: parsed.errors };
  }
  return planDocumentFormSave({ ...args, draft: parsed.draft });
}
