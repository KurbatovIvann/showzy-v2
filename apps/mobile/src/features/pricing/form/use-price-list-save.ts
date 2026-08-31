/**
 * Price-list form save hook (SHO-304). Wraps `runPriceListFormSave` with
 * `useBoundContractMutation` (form-kit plumbing). The multi-write loop
 * stays here: `runFormSave` is a single pass and would drop remaining
 * name / status / entry writes.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { describeQueryFailure, describeWireError } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useBoundContractMutation } from "../../../api/use-bound-contract-mutation";
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
  readonly setOrigin: (draft: PriceListFormDraft) => void;
  readonly priceListIdRef: { current: string | null };
  readonly baselineRef: { current: PriceListFormSnapshot | null };
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
  const mutation = useBoundContractMutation((client) =>
    bindPriceListFormMutate(client),
  );
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const [saveBusy, setSaveBusy] = useState(false);
  const [lastWrite, setLastWrite] = useState<PriceListFormWrite | null>(null);
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

  async function save(): Promise<void> {
    const current = argsRef.current;
    if (
      mutation.apiClient === null ||
      !canSubmitPriceListForm({
        canManage: current.canManage,
        loadKind: current.loadKind,
      })
    ) {
      return;
    }
    await mutation.runGuarded(async () => {
      if (mountedRef.current) {
        setSaveBusy(true);
      }
      try {
        await runPriceListFormSave({
          getDraft: current.getDraft,
          getMode: () => current.mode,
          getPriceListId: () => current.priceListIdRef.current,
          setPriceListId: (priceListId) => {
            current.priceListIdRef.current = priceListId;
          },
          getBaseline: () => current.baselineRef.current,
          setBaseline: (baseline) => {
            current.baselineRef.current = baseline;
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
        if (mountedRef.current) {
          setSaveBusy(false);
        }
      }
    });
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
