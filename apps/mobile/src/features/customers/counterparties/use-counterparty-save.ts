/**
 * Counterparty form save hook (SHO-196). Wraps `runCounterpartyFormSave`
 * with `useContractMutation` and customers invalidation + leave-arm
 * callbacks.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { bindCounterpartyFormMutate } from "../api/counterparty-form-mutation";
import { invalidateCustomersAfterWrite } from "../api/customer-status";
import type {
  CounterpartyFormDraft,
  CounterpartyFormFieldErrors,
  CounterpartyFormMode,
  CounterpartyFormSnapshot,
} from "./counterparty-form-draft";
import type { CounterpartyFormLoadState } from "./counterparty-form-load";
import type { CounterpartyFormWrite } from "./counterparty-form-plan";
import {
  NO_SAVE_FAILURE,
  runCounterpartyFormSave,
  type LastWriteFailure,
} from "./counterparty-form-save";

export { runCounterpartyFormSave } from "./counterparty-form-save";
export type {
  LastWriteFailure,
  CounterpartyFormSavePorts,
} from "./counterparty-form-save";

export function useCounterpartySave(args: {
  readonly mode: CounterpartyFormMode;
  readonly loadKind: CounterpartyFormLoadState["kind"];
  readonly getDraft: () => CounterpartyFormDraft;
  readonly setDraft: (draft: CounterpartyFormDraft) => void;
  readonly setOrigin: (draft: CounterpartyFormDraft) => void;
  readonly counterpartyIdRef: { current: string | null };
  readonly baselineRef: { current: CounterpartyFormSnapshot | null };
  readonly setBaseline: (baseline: CounterpartyFormSnapshot | null) => void;
  readonly onSaved: () => Promise<void>;
  readonly setFieldErrors: (errors: CounterpartyFormFieldErrors) => void;
}): {
  readonly save: () => Promise<void>;
  readonly pending: boolean;
  readonly lastWrite: CounterpartyFormWrite | null;
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
  const [lastWrite, setLastWrite] = useState<CounterpartyFormWrite | null>(
    null,
  );
  const saveBusyRef = useRef(false);
  const lastWriteRef = useRef<CounterpartyFormWrite | null>(null);
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

  const mutation = useContractMutation(
    (input: CounterpartyFormWrite, options) => {
      const current = apiRef.current;
      if (current === null) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return bindCounterpartyFormMutate(current)(input, options);
    },
  );

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
      await runCounterpartyFormSave({
        getDraft: current.getDraft,
        getMode: () => current.mode,
        getCounterpartyId: () => current.counterpartyIdRef.current,
        setCounterpartyId: (counterpartyId) => {
          current.counterpartyIdRef.current = counterpartyId;
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
