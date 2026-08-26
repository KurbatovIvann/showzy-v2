import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActor } from "@xstate/react";
import { useEffect, useRef } from "react";

import { useApiClient } from "../../../../api/api-provider";
import { useContractMutation } from "../../../../api/contract-mutation";
import { describeQueryFailure } from "../../../../api/errors";
import { fileDownloadUrlsQueryOptions } from "../../../../api/file-download-query";
import { useActiveCompany } from "../../../../api/query-provider";
import { useResolvedCompany } from "../../../../company-resolution/resolved-company-provider";
import { detectLocale } from "../../../../i18n/locale";
import { productsCopy } from "../../../../i18n/products";
import { invalidateCatalogAfterStatusWrite } from "../api/product-archive";
import {
  classifyProductPhotosLoad,
  mapPhotoFailure,
  remainingPhotoSlots,
  resolvePhotoBanner,
  type PhotoBannerKey,
} from "./product-photos-model";
import {
  bindSetProductImages,
  type SetProductImagesInput,
} from "../api/product-photos-mutation";
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
  photoSessionDirty,
  photoSessionNeedsCommit,
  photoSessionTiles,
  productPhotosSessionLogic,
  snapshotFileIdsFromArgs,
  type PhotoSessionContext,
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
  const copy = productsCopy(detectLocale());
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const queryClient = useQueryClient();
  const canWrite = args.canWrite;
  const snapshotFileIds = snapshotFileIdsFromArgs(args);

  const [snapshot, send, actorRef] = useActor(productPhotosSessionLogic, {
    input: {
      productId: args.productId,
      requireProduct: args.requireProduct,
      snapshotFileIds,
    },
  });
  const actorBox = useRef(actorRef);
  actorBox.current = actorRef;
  const session: PhotoSessionContext = snapshot.context;

  const committedIds = session.slots
    .filter((slot) => slot.kind === "committed")
    .map((slot) => slot.fileId);
  const urlsQuery = useQuery(
    fileDownloadUrlsQueryOptions({
      client:
        canWrite && canFetchFileDownloadUrls(membership.role)
          ? apiClient
          : null,
      companyId: activeCompanyId,
      fileIds: committedIds,
      getActiveCompany: () => apiClient?.getActiveCompany() ?? null,
    }),
  );
  const previewByFileId = new Map<string, string>();
  for (const file of urlsQuery.data?.files ?? []) {
    previewByFileId.set(file.fileId, file.downloadUrl);
  }

  const mutation = useContractMutation(
    (input: SetProductImagesInput, options) => {
      const current = apiRef.current;
      if (current === null) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return bindSetProductImages(current)(input, options);
    },
  );

  const runtimeRef = useRef<ProductPhotosRuntime | undefined>(undefined);
  const commitRef = useRef<() => Promise<void>>(() => Promise.resolve());
  if (runtimeRef.current === undefined) {
    runtimeRef.current = createProductPhotosRuntime({
      getContext: () => actorBox.current.getSnapshot().context,
      send: (event: PhotoSessionEvent) => {
        actorBox.current.send(event);
      },
      getClient: () => apiRef.current,
      commitIfNeeded: () => commitRef.current(),
      pickPhotos: pickProductPhotos,
      prepareImage: prepareCatalogImage,
      putBytes: putCatalogBytes,
    });
  }
  const runtime = runtimeRef.current;
  commitRef.current = () =>
    runPhotoCommitLoop({
      getContext: () => actorBox.current.getSnapshot().context,
      send: (event: PhotoSessionEvent) => {
        actorBox.current.send(event);
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
  const bannerKey: PhotoBannerKey | null =
    session.localBanner ??
    mapPhotoFailure(mutationFailure) ??
    (mutationFailure === null ? null : "commit");
  const banner = resolvePhotoBanner(copy.photos, bannerKey);
  const tiles = photoSessionTiles(session);

  function openPicker(): void {
    if (remainingPhotoSlots(session.slots) > 0) {
      mutation.reset();
    }
    actorBox.current.send({ type: "openPicker" });
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
      actorBox.current.send({ type: "bindProductId", productId });
    },
    flush: () =>
      flushPhotoSession({
        kickIdle: runtime.kickIdleUploads,
        waitUntilSettled: runtime.waitUntilSettled,
        commitIfNeeded: () => commitRef.current(),
        getContext: () => actorBox.current.getSnapshot().context,
        send: (event: PhotoSessionEvent) => {
          actorBox.current.send(event);
        },
      }),
    retry: () => {
      void urlsQuery.refetch();
    },
    retryCommit: () => {
      actorBox.current.send({ type: "setBanner", key: null });
      void commitRef.current();
    },
    openPicker,
    closePicker: () => {
      actorBox.current.send({ type: "closePicker" });
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
