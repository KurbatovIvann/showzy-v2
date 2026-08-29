/**
 * Order create save hook (SHO-213). Wraps `runOrderFormSave` with
 * `useContractMutation` and list invalidation + navigate callbacks.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import {
  bindOrderCreateMutate,
  invalidateOrdersAfterCreate,
} from "../api/order-create";
import type { OrderFormDraft, OrderFormFieldErrors } from "./order-form-draft";
import type { OrderFormLoadState } from "./order-form-load";
import type { OrderFormWrite } from "./order-form-plan";
import {
  NO_SAVE_FAILURE,
  runOrderFormSave,
  type LastWriteFailure,
} from "./order-form-save";

export function useOrderSave(args: {
  readonly loadKind: OrderFormLoadState["kind"];
  readonly getDraft: () => OrderFormDraft;
  readonly setOrigin: (draft: OrderFormDraft) => void;
  readonly onSaved: (orderId: string) => Promise<void>;
  readonly setFieldErrors: (errors: OrderFormFieldErrors) => void;
}): {
  readonly save: () => Promise<void>;
  readonly pending: boolean;
  readonly lastWrite: OrderFormWrite | null;
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
  const [lastWrite, setLastWrite] = useState<OrderFormWrite | null>(null);
  const saveBusyRef = useRef(false);
  const lastWriteRef = useRef<OrderFormWrite | null>(null);
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

  const mutation = useContractMutation((input: OrderFormWrite, options) => {
    const current = apiRef.current;
    if (current === null) {
      return Promise.reject(new TypeError("Failed to fetch"));
    }
    return bindOrderCreateMutate(current)(input, options);
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
      await runOrderFormSave({
        getDraft: current.getDraft,
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
        finish: async (orderId) => {
          await invalidateOrdersAfterCreate({
            queryClient,
            companyId: activeCompanyId,
          });
          await current.onSaved(orderId);
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
