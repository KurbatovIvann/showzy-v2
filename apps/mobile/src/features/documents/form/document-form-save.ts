/**
 * Document create save workflow (SHO-238 / SHO-306). Delegates to
 * form-kit `runFormSave`. Single `documents.createFromOrder` write —
 * `useFormSave` / `runFormSave` fits (no multi-write loop).
 */
import {
  NO_SAVE_FAILURE,
  type LastWriteFailure,
} from "../../../components/form-kit/last-write-failure";
import { runFormSave } from "../../../components/form-kit/run-form-save";
import {
  type DocumentFormDraft,
  type DocumentFormFieldErrors,
} from "./document-form-draft";
import {
  parseThenPlanDocumentFormSave,
  type CreateFromOrderResult,
  type DocumentFormWrite,
} from "./document-form-plan";

export { NO_SAVE_FAILURE, type LastWriteFailure };

export type DocumentFormSavePorts = {
  readonly getDraft: () => DocumentFormDraft;
  readonly setOrigin: (draft: DocumentFormDraft) => void;
  readonly getLastWrite: () => DocumentFormWrite | null;
  readonly setLastWrite: (write: DocumentFormWrite) => void;
  readonly getLastFailure: () => LastWriteFailure;
  readonly setLastFailure: (failure: LastWriteFailure) => void;
  readonly setFieldErrors: (errors: DocumentFormFieldErrors) => void;
  readonly submit: (write: DocumentFormWrite) => Promise<CreateFromOrderResult>;
  readonly retry: () => Promise<CreateFromOrderResult>;
  readonly resetMutation: () => void;
  readonly finish: (result: CreateFromOrderResult) => Promise<void>;
};

export async function runDocumentFormSave(
  ports: DocumentFormSavePorts,
): Promise<void> {
  await runFormSave<
    DocumentFormDraft,
    DocumentFormWrite,
    CreateFromOrderResult,
    DocumentFormFieldErrors
  >({
    plan: () =>
      parseThenPlanDocumentFormSave({
        draft: ports.getDraft(),
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
    finish: async (result) => {
      if (result === null) {
        return;
      }
      await ports.finish(result);
    },
  });
}
