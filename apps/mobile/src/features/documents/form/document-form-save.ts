/**
 * Document create save workflow (SHO-238). RHF `handleSubmit` /
 * `parseDocumentFormUiDraft` owns the UI parse; planner `invalid`
 * reports field errors through `setFieldErrors`. Not `handleSubmit` as
 * the only write.
 */
import type { WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import {
  type DocumentFormDraft,
  type DocumentFormFieldErrors,
} from "./document-form-draft";
import {
  parseThenPlanDocumentFormSave,
  type CreateFromOrderResult,
  type DocumentFormWrite,
} from "./document-form-plan";

export type LastWriteFailure = {
  readonly kind: QueryFailureKind | null;
  readonly wire: WireErrorCode | null;
};

export const NO_SAVE_FAILURE: LastWriteFailure = { kind: null, wire: null };

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
  const plan = parseThenPlanDocumentFormSave({
    draft: ports.getDraft(),
    lastWrite: ports.getLastWrite(),
    lastFailureKind: ports.getLastFailure().kind,
    lastWireCode: ports.getLastFailure().wire,
  });
  if (plan.kind === "invalid") {
    ports.setFieldErrors(plan.errors);
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
  ports.resetMutation();
  ports.setOrigin(ports.getDraft());
  await ports.finish(result);
}
