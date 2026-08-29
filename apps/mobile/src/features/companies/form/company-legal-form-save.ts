/**
 * Company legal form save workflow (SHO-225). RHF `handleSubmit` /
 * `parseCompanyLegalFormUiDraft` owns the UI parse; planner `invalid`
 * reports field errors through `setFieldErrors`. Not `handleSubmit` as
 * the only write.
 */
import type { WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import {
  type CompanyLegalFormDraft,
  type CompanyLegalFormFieldErrors,
  type CompanyLegalFormMode,
  type CompanyLegalFormSnapshot,
} from "./company-legal-form-draft";
import {
  applyWriteSuccess,
  parseThenPlanCompanyLegalFormSave,
  type CompanyLegalFormMutationResult,
  type CompanyLegalFormWrite,
} from "./company-legal-form-plan";

export type LastWriteFailure = {
  readonly kind: QueryFailureKind | null;
  readonly wire: WireErrorCode | null;
};

export const NO_SAVE_FAILURE: LastWriteFailure = { kind: null, wire: null };

export type CompanyLegalFormSavePorts = {
  readonly getDraft: () => CompanyLegalFormDraft;
  readonly getMode: () => CompanyLegalFormMode;
  readonly getBaseline: () => CompanyLegalFormSnapshot | null;
  readonly setDraft: (draft: CompanyLegalFormDraft) => void;
  readonly setBaseline: (baseline: CompanyLegalFormSnapshot | null) => void;
  readonly setOrigin: (draft: CompanyLegalFormDraft) => void;
  readonly getLastWrite: () => CompanyLegalFormWrite | null;
  readonly setLastWrite: (write: CompanyLegalFormWrite) => void;
  readonly getLastFailure: () => LastWriteFailure;
  readonly setLastFailure: (failure: LastWriteFailure) => void;
  readonly setFieldErrors: (errors: CompanyLegalFormFieldErrors) => void;
  readonly submit: (
    write: CompanyLegalFormWrite,
  ) => Promise<CompanyLegalFormMutationResult>;
  readonly retry: () => Promise<CompanyLegalFormMutationResult>;
  readonly resetMutation: () => void;
  readonly finish: () => Promise<void>;
};

export async function runCompanyLegalFormSave(
  ports: CompanyLegalFormSavePorts,
): Promise<void> {
  const plan = parseThenPlanCompanyLegalFormSave({
    mode: ports.getMode(),
    draft: ports.getDraft(),
    baseline: ports.getBaseline(),
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
  void result;
  ports.setLastFailure(NO_SAVE_FAILURE);
  const applied = applyWriteSuccess({
    draft: ports.getDraft(),
  });
  ports.setDraft(applied.draft);
  ports.setBaseline(applied.baseline);
  ports.resetMutation();
  ports.setOrigin(ports.getDraft());
  await ports.finish();
}
