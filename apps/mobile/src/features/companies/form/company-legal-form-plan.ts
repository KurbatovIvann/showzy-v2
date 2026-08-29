/**
 * Company legal form write planner (SHO-225). UI parse happens first via
 * `parseCompanyLegalFormUiDraft`; this file turns a valid draft into one
 * `companies.updateLegal` upsert. Empty optional strings become null.
 * First add (no legal row) always writes when valid; edit noops when
 * the snapshot matches the baseline. ФОП/ТОВ round-trip on `companyType`.
 */
import type { WireErrorCode } from "@showzy/contract";

import type { ContractClient } from "../../../api/client";
import type { QueryFailureKind } from "../../../api/errors";
import {
  emptyToNull,
  isCompanyLegalFormValid,
  parseCompanyLegalFormUiDraft,
  snapshotFromDraft,
  validateCompanyLegalForm,
  type CompanyLegalFormDraft,
  type CompanyLegalFormFieldErrors,
  type CompanyLegalFormMode,
  type CompanyLegalFormSnapshot,
} from "./company-legal-form-draft";

type CompaniesClient = ContractClient["client"]["companies"];
export type UpdateLegalPayload = Parameters<CompaniesClient["updateLegal"]>[0];

export type CompanyLegalFormWrite = {
  readonly kind: "updateLegal";
  readonly input: UpdateLegalPayload;
};

export type CompanyLegalFormSavePlan =
  | { readonly kind: "invalid"; readonly errors: CompanyLegalFormFieldErrors }
  | { readonly kind: "retry" }
  | { readonly kind: "noop" }
  | { readonly kind: "write"; readonly write: CompanyLegalFormWrite };

export type CompanyLegalFormMutationResult = {
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

function optionalFields(draft: CompanyLegalFormDraft): {
  readonly edrpou: string | null;
  readonly legalAddress: string | null;
  readonly iban: string | null;
  readonly bankName: string | null;
  readonly bankMfo: string | null;
  readonly bankEdrpou: string | null;
  readonly phone: string | null;
  readonly email: string | null;
} {
  return {
    edrpou: emptyToNull(draft.edrpou),
    legalAddress: emptyToNull(draft.legalAddress),
    iban: emptyToNull(draft.iban),
    bankName: emptyToNull(draft.bankName),
    bankMfo: emptyToNull(draft.bankMfo),
    bankEdrpou: emptyToNull(draft.bankEdrpou),
    phone: emptyToNull(draft.phone),
    email: emptyToNull(draft.email),
  };
}

export function updateLegalPayload(
  draft: CompanyLegalFormDraft,
): UpdateLegalPayload | null {
  const snapshot = snapshotFromDraft(draft);
  if (snapshot === null) {
    return null;
  }
  return {
    companyType: snapshot.companyType,
    legalName: snapshot.legalName,
    ...optionalFields(draft),
  };
}

export function writesEqual(
  left: CompanyLegalFormWrite,
  right: CompanyLegalFormWrite,
): boolean {
  return JSON.stringify(left.input) === JSON.stringify(right.input);
}

export function isCompanyLegalFormRetryable(
  kind: QueryFailureKind | null,
  wireCode: WireErrorCode | null = null,
): boolean {
  if (wireCode !== null && RETRYABLE_WIRE.has(wireCode)) {
    return true;
  }
  return kind !== null && RETRYABLE_FAILURE.has(kind);
}

function snapshotsEqual(
  left: CompanyLegalFormSnapshot,
  right: CompanyLegalFormSnapshot,
): boolean {
  return (
    left.companyType === right.companyType &&
    left.legalName === right.legalName &&
    left.edrpou === right.edrpou &&
    left.legalAddress === right.legalAddress &&
    left.iban === right.iban &&
    left.bankName === right.bankName &&
    left.bankMfo === right.bankMfo &&
    left.bankEdrpou === right.bankEdrpou &&
    left.phone === right.phone &&
    left.email === right.email
  );
}

export function planCompanyLegalFormSave(args: {
  readonly mode: CompanyLegalFormMode;
  readonly draft: CompanyLegalFormDraft;
  readonly baseline: CompanyLegalFormSnapshot | null;
  readonly lastWrite: CompanyLegalFormWrite | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly lastWireCode?: WireErrorCode | null;
}): CompanyLegalFormSavePlan {
  const errors = validateCompanyLegalForm(args.draft);
  if (!isCompanyLegalFormValid(errors)) {
    return { kind: "invalid", errors };
  }
  const retryable = isCompanyLegalFormRetryable(
    args.lastFailureKind,
    args.lastWireCode ?? null,
  );
  const snapshot = snapshotFromDraft(args.draft);
  if (snapshot === null) {
    return { kind: "invalid", errors };
  }
  if (args.mode === "edit") {
    if (args.baseline === null) {
      return { kind: "invalid", errors };
    }
    if (snapshotsEqual(snapshot, args.baseline)) {
      return { kind: "noop" };
    }
  }
  const input = updateLegalPayload(args.draft);
  if (input === null) {
    return { kind: "invalid", errors };
  }
  const write: CompanyLegalFormWrite = {
    kind: "updateLegal",
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

export function parseThenPlanCompanyLegalFormSave(args: {
  readonly mode: CompanyLegalFormMode;
  readonly draft: CompanyLegalFormDraft;
  readonly baseline: CompanyLegalFormSnapshot | null;
  readonly lastWrite: CompanyLegalFormWrite | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly lastWireCode?: WireErrorCode | null;
}): CompanyLegalFormSavePlan {
  const parsed = parseCompanyLegalFormUiDraft(args.draft);
  if (!parsed.ok) {
    return { kind: "invalid", errors: parsed.errors };
  }
  return planCompanyLegalFormSave({ ...args, draft: parsed.draft });
}

export function applyWriteSuccess(args: {
  readonly draft: CompanyLegalFormDraft;
}): {
  readonly draft: CompanyLegalFormDraft;
  readonly baseline: CompanyLegalFormSnapshot | null;
  readonly done: boolean;
} {
  return {
    draft: args.draft,
    baseline: snapshotFromDraft(args.draft),
    done: true,
  };
}
