/**
 * Group form save hook (SHO-181). Wraps `runGroupFormSave` with
 * `useContractMutation` and customers invalidation + leave-arm callbacks.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { bindGroupFormMutate } from "../api/group-form-mutation";
import { invalidateCustomersAfterWrite } from "../api/customer-status";
import type {
  GroupFormDraft,
  GroupFormFieldErrors,
  GroupFormMode,
  GroupFormSnapshot,
} from "./group-form-draft";
import type { GroupFormLoadState } from "./group-form-load";
import type { GroupFormWrite } from "./group-form-plan";
import {
  NO_SAVE_FAILURE,
  runGroupFormSave,
  type LastWriteFailure,
} from "./group-form-save";

export { runGroupFormSave } from "./group-form-save";
export type { LastWriteFailure, GroupFormSavePorts } from "./group-form-save";

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
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const [saveBusy, setSaveBusy] = useState(false);
  const [lastWrite, setLastWrite] = useState<GroupFormWrite | null>(null);
  const saveBusyRef = useRef(false);
  const lastWriteRef = useRef<GroupFormWrite | null>(null);
  const lastFailureRef = useRef<LastWriteFailure>(NO_SAVE_FAILURE);
  const mountedRef = useRef(true);
  const argsRef = useRef(args);
  argsRef.current = args;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const mutation = useContractMutation((input: GroupFormWrite, options) => {
    const current = apiRef.current;
    if (current === null) {
      return Promise.reject(new TypeError("Failed to fetch"));
    }
    return bindGroupFormMutate(current)(input, options);
  });

  async function save(): Promise<void> {
    const current = argsRef.current;
    if (
      saveBusyRef.current ||
      apiClient === null ||
      current.loadKind !== "ready"
    ) {
      return;
    }
    saveBusyRef.current = true;
    setSaveBusy(true);
    try {
      await runGroupFormSave({
        getDraft: current.getDraft,
        getMode: () => current.mode,
        getGroupId: () => current.groupIdRef.current,
        setGroupId: (groupId) => {
          current.groupIdRef.current = groupId;
        },
        getBaseline: () => current.baselineRef.current,
        setDraft: current.setDraft,
        setBaseline: (baseline) => {
          current.baselineRef.current = baseline;
          current.setBaseline(baseline);
        },
        setOrigin: current.setOrigin,
        getLastWrite: () => lastWriteRef.current,
        setLastWrite: (write) => {
          lastWriteRef.current = write;
          setLastWrite(write);
        },
        getLastFailure: () => lastFailureRef.current,
        setLastFailure: (failure) => {
          lastFailureRef.current = failure;
        },
        setFieldErrors: current.setFieldErrors,
        submit: mutation.submit,
        retry: mutation.retry,
        resetMutation: mutation.reset,
        finish: async () => {
          await invalidateCustomersAfterWrite({
            queryClient,
            companyId: activeCompanyId,
          });
          await current.onSaved();
        },
      });
    } catch (error: unknown) {
      lastFailureRef.current = {
        kind: describeQueryFailure(error).kind,
        wire: describeWireError(error)?.code ?? null,
      };
    } finally {
      saveBusyRef.current = false;
      if (mountedRef.current) {
        setSaveBusy(false);
      }
    }
  }

  return {
    save,
    pending: saveBusy || mutation.isPending,
    lastWrite,
    mutationError: mutation.error,
    isMutationError: mutation.isError,
    resetMutation: () => {
      lastFailureRef.current = NO_SAVE_FAILURE;
      mutation.reset();
    },
  };
}
