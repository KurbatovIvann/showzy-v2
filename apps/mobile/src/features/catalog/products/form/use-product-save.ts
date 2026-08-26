/**
 * Product form save hook (SHO-159). Wraps `runProductFormSave` with
 * `useContractMutation` and the catalog invalidation + leave-arm callbacks.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { useApiClient } from "../../../../api/api-provider";
import { useContractMutation } from "../../../../api/contract-mutation";
import {
  describeQueryFailure,
  describeWireError,
} from "../../../../api/errors";
import { useActiveCompany } from "../../../../api/query-provider";
import { invalidateCatalogAfterStatusWrite } from "../api/product-archive";
import { bindProductFormMutate } from "../api/product-form-mutation";
import {
  NO_SAVE_FAILURE,
  runProductFormSave,
  type LastWriteFailure,
} from "./product-form-save";
import type {
  ProductFormDraft,
  ProductFormFieldErrors,
  ProductFormLoadState,
  ProductFormMode,
  ProductFormSnapshot,
  ProductFormWrite,
} from "./product-form-model";

export { runProductFormSave } from "./product-form-save";
export type {
  LastWriteFailure,
  ProductFormSavePorts,
} from "./product-form-save";

export function useProductSave(args: {
  readonly mode: ProductFormMode;
  readonly loadKind: ProductFormLoadState["kind"];
  readonly getDraft: () => ProductFormDraft;
  readonly setDraft: (draft: ProductFormDraft) => void;
  readonly setOrigin: (draft: ProductFormDraft) => void;
  readonly productIdRef: { current: string | null };
  readonly baselineRef: { current: ProductFormSnapshot | null };
  readonly setBaseline: (baseline: ProductFormSnapshot | null) => void;
  readonly photos: {
    readonly bindProductId: (productId: string) => void;
    readonly flush: () => Promise<"ok" | "commit-failed">;
  };
  readonly onSaved: () => Promise<void>;
  readonly setClientErrors: (errors: ProductFormFieldErrors) => void;
  readonly setLocalBanner: (banner: "too_many_variants" | null) => void;
}): {
  readonly save: () => Promise<void>;
  readonly pending: boolean;
  readonly lastWrite: ProductFormWrite | null;
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
  const [lastWrite, setLastWrite] = useState<ProductFormWrite | null>(null);
  const saveBusyRef = useRef(false);
  const lastWriteRef = useRef<ProductFormWrite | null>(null);
  const lastFailureRef = useRef<LastWriteFailure>(NO_SAVE_FAILURE);
  const mountedRef = useRef(true);
  const photosRef = useRef(args.photos);
  photosRef.current = args.photos;
  const argsRef = useRef(args);
  argsRef.current = args;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const mutation = useContractMutation((input: ProductFormWrite, options) => {
    const current = apiRef.current;
    if (current === null) {
      return Promise.reject(new TypeError("Failed to fetch"));
    }
    return bindProductFormMutate(current)(input, options);
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
      await runProductFormSave({
        getDraft: current.getDraft,
        getMode: () => current.mode,
        getProductId: () => current.productIdRef.current,
        setProductId: (productId) => {
          current.productIdRef.current = productId;
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
        setClientErrors: current.setClientErrors,
        setTooManyVariants: () => {
          current.setLocalBanner("too_many_variants");
        },
        submit: mutation.submit,
        retry: mutation.retry,
        resetMutation: mutation.reset,
        bindProductId: (productId) => {
          photosRef.current.bindProductId(productId);
        },
        flushPhotos: () => photosRef.current.flush(),
        finish: async () => {
          await invalidateCatalogAfterStatusWrite({
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
