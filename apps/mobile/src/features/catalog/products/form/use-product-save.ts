/**
 * Product form save hook (SHO-159). Wraps `runProductFormSave` with
 * `useBoundContractMutation` and the catalog invalidation + leave-arm callbacks.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import {
  describeQueryFailure,
  describeWireError,
} from "../../../../api/errors";
import { useActiveCompany } from "../../../../api/query-provider";
import { useBoundContractMutation } from "../../../../api/use-bound-contract-mutation";
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
  ProductFormMode,
  ProductFormSnapshot,
} from "./product-form-draft";
import type { ProductFormLoadState } from "./product-form-load";
import type { ProductFormWrite } from "./product-form-plan";

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
    readonly flush: () => Promise<"ok" | "commit-failed" | "upload-failed">;
  };
  readonly onSaved: () => Promise<void>;
  readonly setFieldErrors: (errors: ProductFormFieldErrors) => void;
  readonly setLocalBanner: (banner: "too_many_variants" | null) => void;
}): {
  readonly save: () => Promise<void>;
  readonly pending: boolean;
  readonly lastWrite: ProductFormWrite | null;
  readonly mutationError: unknown;
  readonly isMutationError: boolean;
  readonly resetMutation: () => void;
} {
  const mutation = useBoundContractMutation((client) =>
    bindProductFormMutate(client),
  );
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const [saveBusy, setSaveBusy] = useState(false);
  const [lastWrite, setLastWrite] = useState<ProductFormWrite | null>(null);
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

  async function save(): Promise<void> {
    const current = argsRef.current;
    if (mutation.apiClient === null || current.loadKind !== "ready") {
      return;
    }
    await mutation.runGuarded(async () => {
      if (mountedRef.current) {
        setSaveBusy(true);
      }
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
          setFieldErrors: current.setFieldErrors,
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
