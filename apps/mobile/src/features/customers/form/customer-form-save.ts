/**
 * Customer form save workflow (SHO-180). RHF `handleSubmit` /
 * `parseCustomerFormUiDraft` owns the UI parse; planner `invalid`
 * reports field errors through `setFieldErrors`. Not `handleSubmit` as
 * the only write.
 */
import type { WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import {
  type CustomerFormDraft,
  type CustomerFormFieldErrors,
  type CustomerFormMode,
  type CustomerFormSnapshot,
} from "./customer-form-draft";
import {
  applyWriteSuccess,
  parseThenPlanCustomerFormSave,
  type CustomerFormMutationResult,
  type CustomerFormWrite,
} from "./customer-form-plan";

export type LastWriteFailure = {
  readonly kind: QueryFailureKind | null;
  readonly wire: WireErrorCode | null;
};

export const NO_SAVE_FAILURE: LastWriteFailure = { kind: null, wire: null };

export type CustomerFormSavePorts = {
  readonly getDraft: () => CustomerFormDraft;
  readonly getMode: () => CustomerFormMode;
  readonly getCustomerId: () => string | null;
  readonly setCustomerId: (customerId: string) => void;
  readonly getBaseline: () => CustomerFormSnapshot | null;
  readonly setDraft: (draft: CustomerFormDraft) => void;
  readonly setBaseline: (baseline: CustomerFormSnapshot | null) => void;
  readonly setOrigin: (draft: CustomerFormDraft) => void;
  readonly getLastWrite: () => CustomerFormWrite | null;
  readonly setLastWrite: (write: CustomerFormWrite) => void;
  readonly getLastFailure: () => LastWriteFailure;
  readonly setLastFailure: (failure: LastWriteFailure) => void;
  readonly setFieldErrors: (errors: CustomerFormFieldErrors) => void;
  readonly submit: (
    write: CustomerFormWrite,
  ) => Promise<CustomerFormMutationResult>;
  readonly retry: () => Promise<CustomerFormMutationResult>;
  readonly resetMutation: () => void;
  readonly finish: () => Promise<void>;
};

export async function runCustomerFormSave(
  ports: CustomerFormSavePorts,
): Promise<void> {
  const mode = ports.getMode();
  const customerId = ports.getCustomerId();
  const plan = parseThenPlanCustomerFormSave({
    mode: customerId !== null && mode === "create" ? "edit" : mode,
    customerId,
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
  ports.setLastFailure(NO_SAVE_FAILURE);
  if (write.kind === "createCustomer") {
    ports.setCustomerId(result.id);
  }
  const applied = applyWriteSuccess({
    draft: ports.getDraft(),
    write,
  });
  ports.setDraft(applied.draft);
  ports.setBaseline(applied.baseline);
  ports.resetMutation();
  ports.setOrigin(ports.getDraft());
  await ports.finish();
}
