/**
 * Group form save hook (SHO-181 / SHO-307). Single create/update write —
 * form-kit `useFormSave` / `runFormSave` fits.
 */
import { useQueryClient } from "@tanstack/react-query";
import type { MutationCallOptions } from "@showzy/contract";

import type { ContractClient } from "../../../api/client";
import { useActiveCompany } from "../../../api/query-provider";
import { useFormSave } from "../../../components/form-kit";
import { invalidateCustomersAfterWrite } from "../api/customer-status";
import { bindGroupFormMutate } from "../api/group-form-mutation";
import type {
  GroupFormDraft,
  GroupFormFieldErrors,
  GroupFormMode,
  GroupFormSnapshot,
} from "./group-form-draft";
import type { GroupFormLoadState } from "./group-form-load";
import {
  applyWriteSuccess,
  parseThenPlanGroupFormSave,
  type GroupFormMutationResult,
  type GroupFormWrite,
} from "./group-form-plan";

export { runGroupFormSave } from "./group-form-save";
export type { LastWriteFailure, GroupFormSavePorts } from "./group-form-save";

function bindGroupSave(
  client: ContractClient,
): (
  input: GroupFormWrite,
  options: MutationCallOptions,
) => Promise<GroupFormMutationResult> {
  return bindGroupFormMutate(client);
}

export function useGroupSave(args: {
  readonly mode: GroupFormMode;
  readonly loadKind: GroupFormLoadState["kind"];
  readonly getDraft: () => GroupFormDraft;
  readonly setDraft: (draft: GroupFormDraft) => void;
  readonly setOrigin: (draft: GroupFormDraft) => void;
  readonly groupIdRef: { current: string | null };
  readonly baselineRef: { current: GroupFormSnapshot | null };
  readonly setBaseline: (baseline: GroupFormSnapshot | null) => void;
  readonly onSaved: () => Promise<void>;
  readonly setFieldErrors: (errors: GroupFormFieldErrors) => void;
}): {
  readonly save: () => Promise<void>;
  readonly pending: boolean;
  readonly lastWrite: GroupFormWrite | null;
  readonly mutationError: unknown;
  readonly isMutationError: boolean;
  readonly resetMutation: () => void;
} {
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();

  return useFormSave<
    GroupFormDraft,
    GroupFormWrite,
    GroupFormMutationResult,
    GroupFormFieldErrors
  >({
    bindMutate: bindGroupSave,
    invalidate: () =>
      invalidateCustomersAfterWrite({
        queryClient,
        companyId: activeCompanyId,
      }),
    ready: args.loadKind === "ready",
    getDraft: args.getDraft,
    setOrigin: args.setOrigin,
    setFieldErrors: args.setFieldErrors,
    plan: ({ lastWrite, lastFailure }) => {
      const groupId = args.groupIdRef.current;
      return parseThenPlanGroupFormSave({
        mode: groupId !== null && args.mode === "create" ? "edit" : args.mode,
        groupId,
        draft: args.getDraft(),
        baseline: args.baselineRef.current,
        lastWrite,
        lastFailureKind: lastFailure.kind,
        lastWireCode: lastFailure.wire,
      });
    },
    applySuccess: ({ draft, write, result }) => {
      if (write.kind === "createGroup") {
        args.groupIdRef.current = result.id;
      }
      const applied = applyWriteSuccess({ draft, write });
      args.setDraft(applied.draft);
      args.baselineRef.current = applied.baseline;
      args.setBaseline(applied.baseline);
    },
    onSaved: () => args.onSaved(),
  });
}
