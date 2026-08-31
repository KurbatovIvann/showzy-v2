import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { useBoundContractMutation } from "../../../../api/use-bound-contract-mutation";
import { describeQueryFailure } from "../../../../api/errors";
import { useActiveCompany } from "../../../../api/query-provider";
import { useResolvedCompany } from "../../../../company-resolution/resolved-company-provider";
import { detectLocale } from "../../../../i18n/locale";
import { productsCopy } from "../../../../i18n/products";
import { invalidateCatalogAfterStatusWrite } from "../api/product-archive";
import {
  classifyProductPhotosLoad,
  productPhotosStripQueryOptions,
  remainingPhotoSlots,
  resolvePhotoBanner,
  resolveProductPhotosBannerKey,
} from "./product-photos-model";
import { bindSetProductImages } from "../api/product-photos-mutation";
import { canFetchFileDownloadUrls } from "../shared/product-permissions";
import {
  pickProductPhotos,
  prepareCatalogImage,
  putCatalogBytes,
} from "./product-photos-native";
import {
  flushPhotoSession,
  runPhotoCommitLoop,
  type ProductPhotosFlushResult,
} from "./product-photos-commit";
import {
  createProductPhotosRuntime,
  type ProductPhotosRuntime,
} from "./product-photos-runtime";
import {
  reducePhotoSession,
  initialPhotoSessionContext,
  photoSessionDirty,
  photoSessionNeedsCommit,
  photoSessionTiles,
  snapshotFileIdsFromArgs,
  type PhotoSessionEvent,
} from "./product-photos-session";

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

  const committedIds = useMemo(
    () =>
      session.slots
        .filter((slot) => slot.kind === "committed")
        .map((slot) => slot.fileId),
    [session.slots],
  );
  const urlsQuery = useQuery(
    productPhotosStripQueryOptions({
      client: apiClient,
      companyId: activeCompanyId,
      getActiveCompany: () => apiClient?.getActiveCompany() ?? null,
      fileIds: committedIds,
      canWrite,
      canFetchImages: canFetchFileDownloadUrls(membership.role),
    }),
  );
  const previewByFileId = useMemo(() => {
    const map = new Map<string, string>();
    for (const file of urlsQuery.data?.files ?? []) {
      map.set(file.fileId, file.downloadUrl);
    }
    return map;
  }, [urlsQuery.data?.files]);

  const sendRef = useRef(send);
  sendRef.current = send;
  const runtimeRef = useRef<ProductPhotosRuntime | undefined>(undefined);
  const commitRef = useRef<() => Promise<void>>(() => Promise.resolve());
  if (runtimeRef.current === undefined) {
    runtimeRef.current = createProductPhotosRuntime({
      getContext: () => sessionRef.current,
      send: (event: PhotoSessionEvent) => {
        sendRef.current(event);
      },
      getClient: () => apiClientRef.current,
      commitIfNeeded: () => commitRef.current(),
      pickPhotos: pickProductPhotos,
      prepareImage: prepareCatalogImage,
      putBytes: putCatalogBytes,
    });
  }
  const runtime = runtimeRef.current;
  commitRef.current = () =>
    runPhotoCommitLoop({
      getContext: () => sessionRef.current,
      send: (event: PhotoSessionEvent) => {
        sendRef.current(event);
      },
      submit: mutation.submit,
      retry: mutation.retry,
      reset: mutation.reset,
      invalidate: () =>
        invalidateCatalogAfterStatusWrite({
          queryClient,
          companyId: activeCompanyId,
        }),
      onSettled: runtime.notifySettled,
    });

  useEffect(() => {
    runtime.setMounted(true);
    return () => {
      runtime.setMounted(false);
      runtime.abortAll();
    };
  }, [runtime]);

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
  const downloadFailure = urlsQuery.isError
    ? describeQueryFailure(urlsQuery.error).kind
    : null;
  const banner = resolvePhotoBanner(
    copy.photos,
    resolveProductPhotosBannerKey({
      localBanner: session.localBanner,
      mutationFailure,
      downloadFailure,
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
    previewByFileId,
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
    flush: () =>
      flushPhotoSession({
        kickIdle: runtime.kickIdleUploads,
        waitUntilSettled: runtime.waitUntilSettled,
        commitIfNeeded: () => commitRef.current(),
        getContext: () => sessionRef.current,
        send: (event: PhotoSessionEvent) => {
          sendRef.current(event);
        },
      }),
    retry: () => {
      void urlsQuery.refetch();
    },
    retryCommit: () => {
      send({ type: "setBanner", key: null });
      void commitRef.current();
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
