/**
 * Counterparty form save workflow (SHO-196). RHF `handleSubmit` /
 * `parseCounterpartyFormUiDraft` owns the UI parse; planner `invalid`
 * reports field errors through `setFieldErrors`. Not `handleSubmit` as
 * the only write.
 */
import type { WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import {
  type CounterpartyFormDraft,
  type CounterpartyFormFieldErrors,
  type CounterpartyFormMode,
  type CounterpartyFormSnapshot,
} from "./counterparty-form-draft";
import {
  applyWriteSuccess,
  parseThenPlanCounterpartyFormSave,
  type CounterpartyFormMutationResult,
  type CounterpartyFormWrite,
} from "./counterparty-form-plan";

export type LastWriteFailure = {
  readonly kind: QueryFailureKind | null;
  readonly wire: WireErrorCode | null;
};

export const NO_SAVE_FAILURE: LastWriteFailure = { kind: null, wire: null };

export type CounterpartyFormSavePorts = {
  readonly getDraft: () => CounterpartyFormDraft;
  readonly getMode: () => CounterpartyFormMode;
  readonly getCounterpartyId: () => string | null;
  readonly setCounterpartyId: (counterpartyId: string) => void;
  readonly getBaseline: () => CounterpartyFormSnapshot | null;
  readonly setDraft: (draft: CounterpartyFormDraft) => void;
  readonly setBaseline: (baseline: CounterpartyFormSnapshot | null) => void;
  readonly setOrigin: (draft: CounterpartyFormDraft) => void;
  readonly getLastWrite: () => CounterpartyFormWrite | null;
  readonly setLastWrite: (write: CounterpartyFormWrite) => void;
  readonly getLastFailure: () => LastWriteFailure;
  readonly setLastFailure: (failure: LastWriteFailure) => void;
  readonly setFieldErrors: (errors: CounterpartyFormFieldErrors) => void;
  readonly submit: (
    write: CounterpartyFormWrite,
  ) => Promise<CounterpartyFormMutationResult>;
  readonly retry: () => Promise<CounterpartyFormMutationResult>;
  readonly resetMutation: () => void;
  readonly finish: () => Promise<void>;
};

export async function runCounterpartyFormSave(
  ports: CounterpartyFormSavePorts,
): Promise<void> {
  const mode = ports.getMode();
  const counterpartyId = ports.getCounterpartyId();
  const plan = parseThenPlanCounterpartyFormSave({
    mode: counterpartyId !== null && mode === "create" ? "edit" : mode,
    counterpartyId,
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
  if (write.kind === "createCounterparty") {
    ports.setCounterpartyId(result.id);
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
