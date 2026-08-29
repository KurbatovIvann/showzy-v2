/**
 * Invitation create write planner (SHO-206). UI parse happens first via
 * `parseInvitationFormUiDraft`; this file turns a valid draft into one
 * `invites.create` write. Personal omits `maxUses` (server stores 1).
 * Reusable empty cap is `null` (unlimited). Create-only: noop is the
 * already-created secret screen, not an edit snapshot.
 */
import type { WireErrorCode } from "@showzy/contract";

import type { ContractClient } from "../../../api/client";
import type { QueryFailureKind } from "../../../api/errors";
import {
  isInvitationFormValid,
  parseInvitationFormUiDraft,
  snapshotFromDraft,
  validateInvitationForm,
  type InvitationFormDraft,
  type InvitationFormFieldErrors,
  type InvitationFormSnapshot,
} from "./invitation-form-draft";

type InvitesClient = ContractClient["client"]["invites"];
export type CreateInvitePayload = Parameters<InvitesClient["create"]>[0];
export type CreateInviteOutput = Awaited<ReturnType<InvitesClient["create"]>>;

export type InvitationFormWrite = {
  readonly kind: "createInvite";
  readonly input: CreateInvitePayload;
};

export type InvitationFormSavePlan =
  | { readonly kind: "invalid"; readonly errors: InvitationFormFieldErrors }
  | { readonly kind: "retry" }
  | { readonly kind: "noop" }
  | { readonly kind: "write"; readonly write: InvitationFormWrite };

export type InviteCreateSecret = {
  readonly id: string;
  readonly token: string;
  readonly url: string;
};

export type InvitationFormMutationResult = InviteCreateSecret;

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

export function secretFromCreateOutput(
  output: CreateInviteOutput,
): InviteCreateSecret {
  return {
    id: output.id,
    token: output.token,
    url: output.url,
  };
}

export function createInvitePayload(
  draft: InvitationFormDraft,
): CreateInvitePayload | null {
  const snapshot = snapshotFromDraft(draft);
  if (snapshot === null) {
    return null;
  }
  return payloadFromSnapshot(snapshot);
}

function payloadFromSnapshot(
  snapshot: InvitationFormSnapshot,
): CreateInvitePayload {
  const shared = {
    expiresAt: snapshot.expiresAt,
    groupId: snapshot.groupId,
    priceListId: snapshot.priceListId,
    name: snapshot.name,
    phone: snapshot.phone,
    email: snapshot.email,
  };
  if (snapshot.isReusable) {
    return {
      isReusable: true,
      maxUses: snapshot.maxUses,
      ...shared,
    };
  }
  return {
    isReusable: false,
    ...shared,
  };
}

export function writesEqual(
  left: InvitationFormWrite,
  right: InvitationFormWrite,
): boolean {
  return JSON.stringify(left.input) === JSON.stringify(right.input);
}

export function isInvitationFormRetryable(
  kind: QueryFailureKind | null,
  wireCode: WireErrorCode | null = null,
): boolean {
  if (wireCode !== null && RETRYABLE_WIRE.has(wireCode)) {
    return true;
  }
  return kind !== null && RETRYABLE_FAILURE.has(kind);
}

export function planInvitationFormSave(args: {
  readonly draft: InvitationFormDraft;
  readonly created: InviteCreateSecret | null;
  readonly lastWrite: InvitationFormWrite | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly lastWireCode?: WireErrorCode | null;
}): InvitationFormSavePlan {
  if (args.created !== null) {
    return { kind: "noop" };
  }
  const errors = validateInvitationForm(args.draft);
  if (!isInvitationFormValid(errors)) {
    return { kind: "invalid", errors };
  }
  const input = createInvitePayload(args.draft);
  if (input === null) {
    return { kind: "invalid", errors };
  }
  const write: InvitationFormWrite = { kind: "createInvite", input };
  const retryable = isInvitationFormRetryable(
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

export function parseThenPlanInvitationFormSave(args: {
  readonly draft: InvitationFormDraft;
  readonly created: InviteCreateSecret | null;
  readonly lastWrite: InvitationFormWrite | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly lastWireCode?: WireErrorCode | null;
}): InvitationFormSavePlan {
  const parsed = parseInvitationFormUiDraft(args.draft);
  if (!parsed.ok) {
    return { kind: "invalid", errors: parsed.errors };
  }
  return planInvitationFormSave({ ...args, draft: parsed.draft });
}
