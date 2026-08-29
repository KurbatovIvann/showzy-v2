/**
 * Invitation create write planner (SHO-206). UI parse happens first via
 * `parseInvitationFormUiDraft`; this file turns a valid draft into one
 * `invites.create` write. Personal omits `maxUses` (server stores 1).
 * Reusable empty cap is `null` (unlimited). Create-only: noop is the
 * already-created secret screen, not an edit snapshot.
 *
 * Retry after a lost/timed-out `invites.create` must reuse the frozen
 * `lastWrite` (same idempotency key). Reclamp only for a fresh write.
 */
import type { WireErrorCode } from "@showzy/contract";

import type { ContractClient } from "../../../api/client";
import type { QueryFailureKind } from "../../../api/errors";
import {
  emptyToNull,
  isInvitationFormValid,
  parseInvitationFormUiDraft,
  reclampInvitationDraftExpiresAt,
  snapshotFromDraft,
  validateInvitationForm,
  type InvitationFormDraft,
  type InvitationFormFieldErrors,
  type InvitationFormSnapshot,
} from "./invitation-form-draft";
import {
  expiresAtInRange,
  parseInviteMaxUsesInput,
} from "./invitation-form.schema";

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
  nowMs: number = Date.now(),
): CreateInvitePayload | null {
  const snapshot = snapshotFromDraft(draft, nowMs);
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

type CreateIntentWithoutExpires = {
  readonly isReusable: boolean;
  readonly maxUses: number | null | "invalid";
  readonly groupId: string | null;
  readonly priceListId: string | null;
  readonly name: string | null;
  readonly phone: string | null;
  readonly email: string | null;
};

function createIntentWithoutExpires(
  draft: InvitationFormDraft,
): CreateIntentWithoutExpires {
  const isReusable = draft.kind === "reusable";
  const parsedMax = parseInviteMaxUsesInput(draft.maxUses);
  return {
    isReusable,
    maxUses: isReusable
      ? parsedMax === "invalid"
        ? "invalid"
        : parsedMax
      : null,
    groupId: draft.groupId,
    priceListId: draft.priceListId,
    name: emptyToNull(draft.name),
    phone: emptyToNull(draft.phone),
    email: emptyToNull(draft.email),
  };
}

function lastWriteIntentWithoutExpires(
  input: CreateInvitePayload,
): CreateIntentWithoutExpires {
  return {
    isReusable: input.isReusable,
    maxUses: input.isReusable ? (input.maxUses ?? null) : null,
    groupId: input.groupId,
    priceListId: input.priceListId,
    name: input.name,
    phone: input.phone,
    email: input.email,
  };
}

function invitationDraftMatchesFrozenWrite(
  draft: InvitationFormDraft,
  lastWrite: InvitationFormWrite,
  nowMs: number,
): boolean {
  if (
    JSON.stringify(createIntentWithoutExpires(draft)) !==
    JSON.stringify(lastWriteIntentWithoutExpires(lastWrite.input))
  ) {
    return false;
  }
  if (draft.expiresAt === lastWrite.input.expiresAt) {
    return true;
  }
  // First submit may have reclamped into lastWrite without writing back
  // to the RHF draft. A different in-range expiry is a user edit.
  return !expiresAtInRange(draft.expiresAt, nowMs);
}

function shouldRetryFrozenInviteWrite(args: {
  readonly draft: InvitationFormDraft;
  readonly created: InviteCreateSecret | null;
  readonly lastWrite: InvitationFormWrite | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly lastWireCode?: WireErrorCode | null;
  readonly nowMs: number;
}): boolean {
  if (args.created !== null || args.lastWrite === null) {
    return false;
  }
  if (
    !isInvitationFormRetryable(args.lastFailureKind, args.lastWireCode ?? null)
  ) {
    return false;
  }
  return invitationDraftMatchesFrozenWrite(
    args.draft,
    args.lastWrite,
    args.nowMs,
  );
}

export function planInvitationFormSave(args: {
  readonly draft: InvitationFormDraft;
  readonly created: InviteCreateSecret | null;
  readonly lastWrite: InvitationFormWrite | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly lastWireCode?: WireErrorCode | null;
  readonly nowMs?: number;
}): InvitationFormSavePlan {
  if (args.created !== null) {
    return { kind: "noop" };
  }
  const nowMs = args.nowMs ?? Date.now();
  if (shouldRetryFrozenInviteWrite({ ...args, nowMs })) {
    return { kind: "retry" };
  }
  const draft = reclampInvitationDraftExpiresAt(args.draft, nowMs);
  const errors = validateInvitationForm(draft);
  if (!isInvitationFormValid(errors)) {
    return { kind: "invalid", errors };
  }
  const input = createInvitePayload(draft, nowMs);
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
  readonly nowMs?: number;
}): InvitationFormSavePlan {
  if (args.created !== null) {
    return { kind: "noop" };
  }
  const nowMs = args.nowMs ?? Date.now();
  if (shouldRetryFrozenInviteWrite({ ...args, nowMs })) {
    return { kind: "retry" };
  }
  const draft = reclampInvitationDraftExpiresAt(args.draft, nowMs);
  const parsed = parseInvitationFormUiDraft(draft);
  if (!parsed.ok) {
    return { kind: "invalid", errors: parsed.errors };
  }
  return planInvitationFormSave({ ...args, draft: parsed.draft, nowMs });
}
