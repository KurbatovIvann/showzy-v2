import type { MutationAttempt } from "@showzy/contract";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActor } from "@xstate/react";
import { useEffect, useRef } from "react";

import { useApiClient } from "../../../../api/api-provider";
import { useContractMutation } from "../../../../api/contract-mutation";
import { describeQueryFailure } from "../../../../api/errors";
import { fileDownloadUrlsQueryOptions } from "../../../../api/file-download-query";
import { useActiveCompany } from "../../../../api/query-provider";
import { useResolvedCompany } from "../../../../company-resolution/resolved-company-provider";
import { createMobileMutationAttempt } from "../../../../crypto/create-attempt";
import { detectLocale } from "../../../../i18n/locale";
import { productsCopy } from "../../../../i18n/products";
import { invalidateCatalogAfterStatusWrite } from "../api/product-archive";
import {
  classifyProductPhotosLoad,
  mapPhotoFailure,
  mapUploadBanner,
  remainingPhotoSlots,
  resolvePhotoBanner,
  type PhotoBannerKey,
} from "./product-photos-model";
import {
  bindSetProductImages,
  type SetProductImagesInput,
} from "../api/product-photos-mutation";
import {
  pickProductPhotos,
  prepareCatalogImage,
  putCatalogBytes,
  type PickedPhoto,
} from "./product-photos-native";
import { waitForSheetHidden } from "../../../../components/ui/sheet-dismiss";
import { canFetchFileDownloadUrls } from "../shared/product-permissions";
import {
  photoSessionDirty,
  photoSessionIsBusy,
  photoSessionNeedsCommit,
  photoSessionTiles,
  productPhotosSessionLogic,
  selectPhotoSessionCommitPlan,
  selectPhotoSessionFlushOutcome,
  selectPhotoSessionIdleIds,
  type PhotoSessionContext,
} from "./product-photos-session";
import {
  runProductPhotoUpload,
  type PreparedCatalogImage,
  type ProductPhotoUploadPorts,
  type UploadMachine,
} from "./product-photos-upload";

type Handshake = {
  prepared: PreparedCatalogImage | null;
  requestAttempt: MutationAttempt | null;
  finalizeAttempt: MutationAttempt | null;
  abort: AbortController;
};

export type ProductPhotosFlushResult = "ok" | "commit-failed";

export type ProductPhotosModel = ReturnType<typeof useProductPhotos>;

function snapshotFileIdsFromArgs(args: {
  readonly imageFileIds?: readonly string[] | undefined;
  readonly requireProduct: boolean;
}): string[] | null {
  if (args.imageFileIds !== undefined) {
    return [...args.imageFileIds];
  }
  return args.requireProduct ? null : [];
}

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
  const session: PhotoSessionContext = snapshot.context;

  const runningRef = useRef(new Set<string>());
  const handshakeRef = useRef(new Map<string, Handshake>());
  const pickMetaRef = useRef(new Map<string, PickedPhoto>());
  const nextLocalRef = useRef(1);
  const mountedRef = useRef(true);
  const settleWaitersRef = useRef<Array<() => void>>([]);
  const sheetHiddenWaitersRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      for (const handshake of handshakeRef.current.values()) {
        handshake.abort.abort();
      }
    };
  }, []);

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

  function portsFor(): ProductPhotoUploadPorts {
    return {
      prepare: (localUri) => {
        const slot = contextNow().slots.find(
          (item) => item.kind === "upload" && item.localUri === localUri,
        );
        const meta =
          slot === undefined ? undefined : pickMetaRef.current.get(slot.id);
        return prepareCatalogImage({
          uri: localUri,
          mimeType: meta?.mimeType,
          fileName: meta?.fileName,
        });
      },
      requestUpload: (input, options) => {
        const current = apiRef.current;
        if (current === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return current.client.files.requestUpload(input, options);
      },
      getUploadUrl: (input) => {
        const current = apiRef.current;
        if (current === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return current.client.files.getUploadUrl(input);
      },
      put: putCatalogBytes,
      finalize: (input, options) => {
        const current = apiRef.current;
        if (current === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return current.client.files.finalizeUpload(input, options);
      },
      createAttempt: createMobileMutationAttempt,
    };
  }

  function updateMachine(id: string, machine: UploadMachine): void {
    actorRef.send({ type: "patchMachine", id, machine });
  }

  function contextNow(): PhotoSessionContext {
    return actorRef.getSnapshot().context;
  }

  async function commitIfNeeded(): Promise<void> {
    if (contextNow().commitBusy) {
      actorRef.send({ type: "queueCommit" });
      return;
    }
    actorRef.send({ type: "beginCommit" });
    try {
      do {
        actorRef.send({ type: "clearCommitQueue" });
        const plan = selectPhotoSessionCommitPlan(contextNow());
        if (plan.kind === "noop") {
          actorRef.send({ type: "commitNoop" });
          mutation.reset();
          return;
        }
        if (plan.kind === "write") {
          actorRef.send({ type: "noteWrite", fileIds: [...plan.fileIds] });
        }
        const output =
          plan.kind === "write"
            ? await mutation.submit({
                productId: plan.productId,
                fileIds: plan.fileIds,
              })
            : await mutation.retry();
        actorRef.send({
          type: "commitSucceeded",
          fileIds: [...output.fileIds],
        });
        mutation.reset();
        await invalidateCatalogAfterStatusWrite({
          queryClient,
          companyId: activeCompanyId,
        });
      } while (contextNow().commitQueued);
    } catch (error: unknown) {
      actorRef.send({
        type: "commitFailed",
        kind: describeQueryFailure(error).kind,
      });
    } finally {
      actorRef.send({ type: "finishCommit" });
      notifySettled();
    }
  }

  async function runSlot(
    id: string,
    trigger: "start" | "retry",
  ): Promise<void> {
    if (runningRef.current.has(id)) {
      return;
    }
    const slot = contextNow().slots.find((item) => item.id === id);
    if (slot === undefined || slot.kind !== "upload") {
      return;
    }
    runningRef.current.add(id);
    const existing = handshakeRef.current.get(id);
    const abort = new AbortController();
    const handshake: Handshake = {
      prepared: existing?.prepared ?? null,
      requestAttempt: existing?.requestAttempt ?? null,
      finalizeAttempt: existing?.finalizeAttempt ?? null,
      abort,
    };
    handshakeRef.current.set(id, handshake);
    try {
      const result = await runProductPhotoUpload({
        localUri: slot.localUri,
        state: slot.machine,
        trigger,
        ports: portsFor(),
        signal: abort.signal,
        prepared: handshake.prepared,
        requestAttempt: handshake.requestAttempt,
        finalizeAttempt: handshake.finalizeAttempt,
        onState: (machine) => {
          handshakeRef.current.set(id, { ...handshake, abort });
          updateMachine(id, machine);
        },
      });
      handshake.prepared = result.prepared;
      handshake.requestAttempt = result.requestAttempt;
      handshake.finalizeAttempt = result.finalizeAttempt;
      const stillPresent = contextNow().slots.some(
        (item) => item.kind === "upload" && item.id === id,
      );
      if (stillPresent) {
        handshakeRef.current.set(id, handshake);
        updateMachine(id, result.machine);
      } else {
        handshakeRef.current.delete(id);
      }
      if (result.machine.phase === "ready") {
        await commitIfNeeded();
      }
      if (result.machine.phase === "failed" && mountedRef.current) {
        actorRef.send({
          type: "setBanner",
          key: mapUploadBanner(result.machine.failure),
        });
      }
    } finally {
      runningRef.current.delete(id);
      notifySettled();
    }
  }

  function kickIdleUploads(): void {
    for (const id of selectPhotoSessionIdleIds(contextNow())) {
      void runSlot(id, "start");
    }
  }

  function openPicker(): void {
    if (remainingPhotoSlots(contextNow().slots) > 0) {
      mutation.reset();
    }
    actorRef.send({ type: "openPicker" });
  }

  function notifySheetHidden(): void {
    const waiters = sheetHiddenWaitersRef.current;
    sheetHiddenWaitersRef.current = [];
    for (const waiter of waiters) {
      waiter();
    }
  }

  function waitUntilSourceSheetHidden(): Promise<void> {
    return waitForSheetHidden(
      new Promise<void>((resolve) => {
        sheetHiddenWaitersRef.current.push(resolve);
      }),
    );
  }

  async function pickFrom(source: "camera" | "library"): Promise<void> {
    const hidden = waitUntilSourceSheetHidden();
    actorRef.send({ type: "closePicker" });
    await hidden;
    const remaining = remainingPhotoSlots(contextNow().slots);
    const result = await pickProductPhotos(source, remaining);
    if (result.kind === "canceled") {
      actorRef.send({ type: "pickCanceled" });
      notifySettled();
      return;
    }
    if (result.kind === "denied") {
      actorRef.send({ type: "pickDenied" });
      notifySettled();
      return;
    }
    const photos = result.photos.map((photo) => {
      const id = `local-${String(nextLocalRef.current)}`;
      nextLocalRef.current += 1;
      pickMetaRef.current.set(id, photo);
      return { id, localUri: photo.uri };
    });
    actorRef.send({ type: "addPhotos", photos });
    kickIdleUploads();
    notifySettled();
  }

  function cancelUpload(id: string): void {
    handshakeRef.current.get(id)?.abort.abort();
    handshakeRef.current.delete(id);
    pickMetaRef.current.delete(id);
    runningRef.current.delete(id);
    actorRef.send({ type: "cancelUpload", id });
    notifySettled();
    void commitIfNeeded();
  }

  function removePhoto(id: string): void {
    const slot = contextNow().slots.find((item) => item.id === id);
    if (slot?.kind === "upload") {
      cancelUpload(id);
      return;
    }
    actorRef.send({ type: "removePhoto", id });
    void commitIfNeeded();
  }

  function movePhoto(id: string, direction: "earlier" | "later"): void {
    actorRef.send({ type: "movePhoto", id, direction });
    void commitIfNeeded();
  }

  function photosBusy(): boolean {
    return photoSessionIsBusy(contextNow()) || runningRef.current.size > 0;
  }

  function notifySettled(): void {
    if (photosBusy()) {
      return;
    }
    const waiters = settleWaitersRef.current;
    settleWaitersRef.current = [];
    for (const waiter of waiters) {
      waiter();
    }
  }

  function waitUntilSettled(): Promise<void> {
    if (!photosBusy()) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      settleWaitersRef.current.push(resolve);
    });
  }

  function bindProductId(productId: string): void {
    actorRef.send({ type: "bindProductId", productId });
  }

  async function flush(): Promise<ProductPhotosFlushResult> {
    kickIdleUploads();
    await waitUntilSettled();
    await commitIfNeeded();
    await waitUntilSettled();
    const outcome = selectPhotoSessionFlushOutcome(contextNow());
    if (outcome === "ok") {
      actorRef.send({ type: "clearFailure" });
    }
    return outcome;
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
    bindProductId,
    flush,
    retry: () => {
      void urlsQuery.refetch();
    },
    retryCommit: () => {
      actorRef.send({ type: "setBanner", key: null });
      void commitIfNeeded();
    },
    openPicker,
    closePicker: () => {
      actorRef.send({ type: "closePicker" });
    },
    onSourceSheetHidden: notifySheetHidden,
    pickCamera: () => {
      void pickFrom("camera");
    },
    pickLibrary: () => {
      void pickFrom("library");
    },
    removePhoto,
    moveEarlier: (id: string) => {
      movePhoto(id, "earlier");
    },
    moveLater: (id: string) => {
      movePhoto(id, "later");
    },
    retryUpload: (id: string) => {
      actorRef.send({ type: "setBanner", key: null });
      const slot = contextNow().slots.find((item) => item.id === id);
      if (slot?.kind === "upload") {
        updateMachine(id, slot.machine);
        void runSlot(id, "retry");
      }
    },
    cancelUpload,
  };
}
