/**
 * Price-list form save hook (SHO-190). Wraps `runPriceListFormSave` with
 * `useContractMutation` and cache invalidation. Create/save are gated on
 * `canManagePriceLists` before any write.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { bindPriceListFormMutate } from "../api/price-list-form-mutation";
import { invalidatePriceListsAfterWrite } from "../api/price-list-status";
import type {
  PriceListFormDraft,
  PriceListFormFieldErrors,
  PriceListFormMode,
  PriceListFormSnapshot,
} from "./price-list-form-draft";
import { canSubmitPriceListForm } from "./price-list-form-load";
import type { PriceListFormLoadState } from "./price-list-form-load";
import type { PriceListFormWrite } from "./price-list-form-plan";
import {
  NO_SAVE_FAILURE,
  runPriceListFormSave,
  type LastWriteFailure,
} from "./price-list-form-save";

export { runPriceListFormSave } from "./price-list-form-save";

export function usePriceListSave(args: {
  readonly mode: PriceListFormMode;
  readonly canManage: boolean;
  readonly loadKind: PriceListFormLoadState["kind"];
  readonly getDraft: () => PriceListFormDraft;
  readonly setDraft: (draft: PriceListFormDraft) => void;
  readonly setOrigin: (draft: PriceListFormDraft) => void;
  readonly priceListIdRef: { current: string | null };
  readonly baselineRef: { current: PriceListFormSnapshot | null };
  readonly setBaseline: (baseline: PriceListFormSnapshot | null) => void;
  readonly onSaved: () => Promise<void>;
  readonly setFieldErrors: (errors: PriceListFormFieldErrors) => void;
}): {
  readonly save: () => Promise<void>;
  readonly pending: boolean;
  readonly lastWrite: PriceListFormWrite | null;
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
  const [lastWrite, setLastWrite] = useState<PriceListFormWrite | null>(null);
  const saveBusyRef = useRef(false);
  const lastWriteRef = useRef<PriceListFormWrite | null>(null);
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

  const mutation = useContractMutation((input: PriceListFormWrite, options) => {
    const current = apiRef.current;
    if (current === null) {
      return Promise.reject(new TypeError("Failed to fetch"));
    }
    return bindPriceListFormMutate(current)(input, options);
  });

  async function save(): Promise<void> {
    const current = argsRef.current;
    if (
      saveBusyRef.current ||
      apiClient === null ||
      !canSubmitPriceListForm({
        canManage: current.canManage,
        loadKind: current.loadKind,
      })
    ) {
      return;
    }
    saveBusyRef.current = true;
    setSaveBusy(true);
    try {
      await runPriceListFormSave({
        getDraft: current.getDraft,
        getMode: () => current.mode,
        getPriceListId: () => current.priceListIdRef.current,
        setPriceListId: (priceListId) => {
          current.priceListIdRef.current = priceListId;
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
          await invalidatePriceListsAfterWrite({
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
