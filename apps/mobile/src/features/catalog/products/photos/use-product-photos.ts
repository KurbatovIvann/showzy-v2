import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { useBoundContractMutation } from "../../../../api/use-bound-contract-mutation";
import { describeQueryFailure } from "../../../../api/errors";
import { useActiveCompany } from "../../../../api/query-provider";
import { useResolvedCompany } from "../../../../company-resolution/resolved-company-provider";
import { detectLocale } from "../../../../i18n/locale";
import { productsCopy } from "../../../../i18n/products";
import { bindSetProductImages } from "../api/product-photos-mutation";
import { classifyProductPhotosLoad } from "../shared/classify-product-load";
import { canFetchFileDownloadUrls } from "../shared/product-permissions";
import type { ProductPhotosFlushResult } from "./product-photos-commit";
import {
  resolvePhotoBanner,
  resolveProductPhotosBannerKey,
} from "./product-photos-banners";
import { remainingPhotoSlots } from "./product-photos-slots";
import {
  reducePhotoSession,
  initialPhotoSessionContext,
  photoSessionDirty,
  photoSessionNeedsCommit,
  photoSessionTiles,
  snapshotFileIdsFromArgs,
  type PhotoSessionEvent,
} from "./product-photos-session";
import { useProductPhotosQuery } from "./use-product-photos-query";
import { useProductPhotosRuntime } from "./use-product-photos-runtime";

export type { ProductPhotosFlushResult };

export type ProductPhotosModel = ReturnType<typeof useProductPhotos>;

export function useProductPhotos(args: {
  readonly productId: string | null;
  readonly imageFileIds?: readonly string[] | undefined;
  readonly requireProduct: boolean;
  readonly canWrite: boolean;
}) {
  const locale = detectLocale();
  const copy = useMemo(() => productsCopy(locale), [locale]);
  const mutation = useBoundContractMutation((client) =>
    bindSetProductImages(client),
  );
  const apiClient = mutation.apiClient;
  const apiClientRef = useRef(apiClient);
  apiClientRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const queryClient = useQueryClient();
  const canWrite = args.canWrite;
  const snapshotFileIds = snapshotFileIdsFromArgs(args);

  const [session, dispatch] = useReducer(
    reducePhotoSession,
    {
      productId: args.productId,
      requireProduct: args.requireProduct,
      snapshotFileIds,
    },
    initialPhotoSessionContext,
  );
  const sessionRef = useRef(session);
  sessionRef.current = session;
  // I/O ports (runtime/commit) read sessionRef in the same tick as send.
  // Do not switch to dispatch-only: a second commit would miss commitBusy.
  const send = useCallback((event: PhotoSessionEvent) => {
    sessionRef.current = reducePhotoSession(sessionRef.current, event);
    dispatch(event);
  }, []);

  const urls = useProductPhotosQuery({
    client: apiClient,
    companyId: activeCompanyId,
    getActiveCompany: () => apiClient?.getActiveCompany() ?? null,
    slots: session.slots,
    canWrite,
    canFetchImages: canFetchFileDownloadUrls(membership.role),
  });
  const { runtime, commitIfNeeded, flush } = useProductPhotosRuntime({
    sessionRef,
    send,
    getClient: () => apiClientRef.current,
    mutation,
    queryClient,
    activeCompanyId,
  });

  useEffect(() => {
    if (args.imageFileIds === undefined && args.requireProduct) {
      return;
    }
    send({
      type: "hydrate",
      productId: args.productId,
      imageFileIds:
        args.imageFileIds === undefined ? [] : [...args.imageFileIds],
    });
  }, [args.imageFileIds, args.productId, args.requireProduct, send]);

  useEffect(() => {
    if (args.productId === null) {
      return;
    }
    send({ type: "bindProductId", productId: args.productId });
  }, [args.productId, send]);

  useEffect(() => {
    send({ type: "setCanRetryAttempt", value: mutation.isError });
  }, [mutation.isError, send]);

  const clientReady = apiClient !== null && activeCompanyId !== null;
  const state = classifyProductPhotosLoad({
    canWrite,
    productId: session.productId,
    requireProduct: args.requireProduct,
    clientReady,
    status:
      args.requireProduct && snapshotFileIds === null ? "pending" : "success",
    failureKind: null,
  });
  const mutationFailure = mutation.isError
    ? describeQueryFailure(mutation.error).kind
    : null;
  const banner = resolvePhotoBanner(
    copy.photos,
    resolveProductPhotosBannerKey({
      localBanner: session.localBanner,
      mutationFailure,
      downloadFailure: urls.downloadFailure,
    }),
  );
  const tiles = photoSessionTiles(session);

  function openPicker(): void {
    if (remainingPhotoSlots(session.slots) > 0) {
      mutation.reset();
    }
    send({ type: "openPicker" });
  }

  return {
    tiles,
    previewByFileId: urls.previewByFileId,
    banner,
    pickerOpen: session.pickerOpen,
    canAdd: remainingPhotoSlots(session.slots) > 0 && state.kind === "ready",
    canRetryCommit: mutation.isError && state.kind === "ready",
    commitPending: session.commitBusy || mutation.isPending,
    dirty: photoSessionDirty(session),
    needsCommit: photoSessionNeedsCommit(session),
    bindProductId: (productId: string) => {
      send({ type: "bindProductId", productId });
    },
    flush,
    retry: urls.refetch,
    retryCommit: () => {
      send({ type: "setBanner", key: null });
      void commitIfNeeded();
    },
    openPicker,
    closePicker: () => {
      send({ type: "closePicker" });
    },
    onSourceSheetHidden: runtime.notifySheetHidden,
    pickCamera: () => {
      void runtime.pickFrom("camera");
    },
    pickLibrary: () => {
      void runtime.pickFrom("library");
    },
    removePhoto: runtime.removePhoto,
    moveEarlier: (id: string) => {
      runtime.movePhoto(id, "earlier");
    },
    moveLater: (id: string) => {
      runtime.movePhoto(id, "later");
    },
    retryUpload: runtime.retryUpload,
    cancelUpload: runtime.cancelUpload,
  };
}
