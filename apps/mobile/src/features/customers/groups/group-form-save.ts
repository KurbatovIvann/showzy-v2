/**
 * Group form save workflow (SHO-181 / SHO-307). Delegates to form-kit
 * `runFormSave`; create still stamps `groupId` in `applySuccess`.
 */
import {
  NO_SAVE_FAILURE,
  type LastWriteFailure,
} from "../../../components/form-kit/last-write-failure";
import { runFormSave } from "../../../components/form-kit/run-form-save";
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

export { NO_SAVE_FAILURE, type LastWriteFailure };

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
  await runFormSave<
    GroupFormDraft,
    GroupFormWrite,
    GroupFormMutationResult,
    GroupFormFieldErrors
  >({
    plan: () => {
      const mode = ports.getMode();
      const groupId = ports.getGroupId();
      return parseThenPlanGroupFormSave({
        mode: groupId !== null && mode === "create" ? "edit" : mode,
        groupId,
        draft: ports.getDraft(),
        baseline: ports.getBaseline(),
        lastWrite: ports.getLastWrite(),
        lastFailureKind: ports.getLastFailure().kind,
        lastWireCode: ports.getLastFailure().wire,
      });
    },
    getDraft: ports.getDraft,
    setOrigin: ports.setOrigin,
    getLastWrite: ports.getLastWrite,
    setLastWrite: ports.setLastWrite,
    setLastFailure: ports.setLastFailure,
    setFieldErrors: ports.setFieldErrors,
    submit: ports.submit,
    retry: ports.retry,
    resetMutation: ports.resetMutation,
    applySuccess: ({ draft, write, result }) => {
      if (write.kind === "createGroup") {
        ports.setGroupId(result.id);
      }
      const applied = applyWriteSuccess({
        draft,
        write,
      });
      ports.setDraft(applied.draft);
      ports.setBaseline(applied.baseline);
    },
    finish: async () => {
      await ports.finish();
    },
  });
}
