/**
 * Invitation create save workflow (SHO-206 / SHO-307). Delegates to
 * form-kit `runFormSave`. The one-time token/url stay in `setCreated`,
 * never a React Query key or list cache field.
 */
import {
  NO_SAVE_FAILURE,
  type LastWriteFailure,
} from "../../../components/form-kit/last-write-failure";
import { runFormSave } from "../../../components/form-kit/run-form-save";
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

export { NO_SAVE_FAILURE, type LastWriteFailure };

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
  await runFormSave<
    InvitationFormDraft,
    InvitationFormWrite,
    InvitationFormMutationResult,
    InvitationFormFieldErrors
  >({
    plan: () =>
      parseThenPlanInvitationFormSave({
        draft: ports.getDraft(),
        created: ports.getCreated(),
        lastWrite: ports.getLastWrite(),
        lastFailureKind: ports.getLastFailure().kind,
        lastWireCode: ports.getLastFailure().wire,
      }),
    getDraft: ports.getDraft,
    setOrigin: ports.setOrigin,
    getLastWrite: ports.getLastWrite,
    setLastWrite: ports.setLastWrite,
    setLastFailure: ports.setLastFailure,
    setFieldErrors: ports.setFieldErrors,
    submit: ports.submit,
    retry: ports.retry,
    resetMutation: ports.resetMutation,
    applySuccess: ({ result }) => {
      ports.setCreated(result);
    },
    finish: async () => {
      await ports.finish();
    },
  });
}
