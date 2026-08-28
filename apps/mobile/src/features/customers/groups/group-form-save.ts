/**
 * Group form save workflow (SHO-181). RHF `handleSubmit` /
 * `parseGroupFormUiDraft` owns the UI parse; planner `invalid`
 * reports field errors through `setFieldErrors`. Not `handleSubmit` as
 * the only write.
 */
import type { WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import {
  type GroupFormDraft,
  type GroupFormFieldErrors,
  type GroupFormMode,
  type GroupFormSnapshot,
} from "./group-form-draft";
import {
  applyWriteSuccess,
  parseThenPlanGroupFormSave,
  type GroupFormMutationResult,
  type GroupFormWrite,
} from "./group-form-plan";

export type LastWriteFailure = {
  readonly kind: QueryFailureKind | null;
  readonly wire: WireErrorCode | null;
};

export const NO_SAVE_FAILURE: LastWriteFailure = { kind: null, wire: null };

export type GroupFormSavePorts = {
  readonly getDraft: () => GroupFormDraft;
  readonly getMode: () => GroupFormMode;
  readonly getGroupId: () => string | null;
  readonly setGroupId: (groupId: string) => void;
  readonly getBaseline: () => GroupFormSnapshot | null;
  readonly setDraft: (draft: GroupFormDraft) => void;
  readonly setBaseline: (baseline: GroupFormSnapshot | null) => void;
  readonly setOrigin: (draft: GroupFormDraft) => void;
  readonly getLastWrite: () => GroupFormWrite | null;
  readonly setLastWrite: (write: GroupFormWrite) => void;
  readonly getLastFailure: () => LastWriteFailure;
  readonly setLastFailure: (failure: LastWriteFailure) => void;
  readonly setFieldErrors: (errors: GroupFormFieldErrors) => void;
  readonly submit: (write: GroupFormWrite) => Promise<GroupFormMutationResult>;
  readonly retry: () => Promise<GroupFormMutationResult>;
  readonly resetMutation: () => void;
  readonly finish: () => Promise<void>;
};

export async function runGroupFormSave(
  ports: GroupFormSavePorts,
): Promise<void> {
  const mode = ports.getMode();
  const groupId = ports.getGroupId();
  const plan = parseThenPlanGroupFormSave({
    mode: groupId !== null && mode === "create" ? "edit" : mode,
    groupId,
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
  if (write.kind === "createGroup") {
    ports.setGroupId(result.id);
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
