/**
 * Invitation create save workflow (SHO-206). RHF `handleSubmit` /
 * `parseInvitationFormUiDraft` owns the UI parse; planner `invalid`
 * reports field errors through `setFieldErrors`. Not `handleSubmit` as
 * the only write. After a successful create the secret is held in
 * component state only — never a React Query key or list cache field.
 */
import type { WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import type {
  InvitationFormDraft,
  InvitationFormFieldErrors,
} from "./invitation-form-draft";
import {
  parseThenPlanInvitationFormSave,
  type InvitationFormMutationResult,
  type InvitationFormWrite,
  type InviteCreateSecret,
} from "./invitation-form-plan";

export type LastWriteFailure = {
  readonly kind: QueryFailureKind | null;
  readonly wire: WireErrorCode | null;
};

export const NO_SAVE_FAILURE: LastWriteFailure = { kind: null, wire: null };

export type InvitationFormSavePorts = {
  readonly getDraft: () => InvitationFormDraft;
  readonly getCreated: () => InviteCreateSecret | null;
  readonly setCreated: (secret: InviteCreateSecret) => void;
  readonly setOrigin: (draft: InvitationFormDraft) => void;
  readonly getLastWrite: () => InvitationFormWrite | null;
  readonly setLastWrite: (write: InvitationFormWrite) => void;
  readonly getLastFailure: () => LastWriteFailure;
  readonly setLastFailure: (failure: LastWriteFailure) => void;
  readonly setFieldErrors: (errors: InvitationFormFieldErrors) => void;
  readonly submit: (
    write: InvitationFormWrite,
  ) => Promise<InvitationFormMutationResult>;
  readonly retry: () => Promise<InvitationFormMutationResult>;
  readonly resetMutation: () => void;
  readonly finish: () => Promise<void>;
};

export async function runInvitationFormSave(
  ports: InvitationFormSavePorts,
): Promise<void> {
  const plan = parseThenPlanInvitationFormSave({
    draft: ports.getDraft(),
    created: ports.getCreated(),
    lastWrite: ports.getLastWrite(),
    lastFailureKind: ports.getLastFailure().kind,
    lastWireCode: ports.getLastFailure().wire,
  });
  if (plan.kind === "invalid") {
    ports.setFieldErrors(plan.errors);
    return;
  }
  if (plan.kind === "noop") {
    ports.setOrigin(ports.getDraft());
    await ports.finish();
    return;
  }
  if (plan.kind === "write") {
    ports.setLastWrite(plan.write);
  }
  const write = ports.getLastWrite();
  if (write === null) {
    return;
  }
  const result =
    plan.kind === "retry" ? await ports.retry() : await ports.submit(write);
  ports.setLastFailure(NO_SAVE_FAILURE);
  ports.setCreated(result);
  ports.resetMutation();
  ports.setOrigin(ports.getDraft());
  await ports.finish();
}
