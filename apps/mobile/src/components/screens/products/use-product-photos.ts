import type { MutationAttempt } from "@showzy/contract";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import {
  describeQueryFailure,
  type QueryFailureKind,
} from "../../../api/errors";
import { fileDownloadUrlsQueryOptions } from "../../../api/file-download-query";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { createMobileMutationAttempt } from "../../../crypto/create-attempt";
import { detectLocale } from "../../../i18n/locale";
import { productsCopy } from "../../../i18n/products";
import { invalidateCatalogAfterStatusWrite } from "./product-archive";
import { productIdFromParam } from "./product-detail-model";
import { getProductQueryOptions } from "./product-detail-query";
import {
  addUploadSlots,
  applyCommitSuccess,
  classifyProductPhotosLoad,
  idleUploadSlots,
  mapPhotoFailure,
  mapUploadBanner,
  movePhotoSlot,
  patchUploadMachine,
  planPhotoCommit,
  remainingPhotoSlots,
  removePhotoSlot,
  resolvePhotoBanner,
  toPhotoTiles,
  type PhotoBannerKey,
  type PhotoSlot,
} from "./product-photos-model";
import {
  bindSetProductImages,
  type SetProductImagesInput,
} from "./product-photos-mutation";
import {
  pickProductPhotos,
  prepareCatalogImage,
  putCatalogBytes,
  type PickedPhoto,
} from "./product-photos-native";
import {
  canEditProducts,
  canFetchFileDownloadUrls,
  canUploadFiles,
} from "./product-permissions";
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

type PickDenied = "camera" | "library" | null;

export type ProductPhotosModel = ReturnType<typeof useProductPhotos>;

export function useProductPhotos(idParam: string | string[] | undefined) {
  const copy = productsCopy(detectLocale());
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const router = useRouter();
  const queryClient = useQueryClient();
  const productId = productIdFromParam(idParam);
  const canWrite =
    canEditProducts(membership.role) && canUploadFiles(membership.role);

  const [slots, setSlots] = useState<readonly PhotoSlot[]>([]);
  const [baseline, setBaseline] = useState<readonly string[] | null>(null);
  const [lastWrite, setLastWrite] = useState<readonly string[] | null>(null);
  const [localBanner, setLocalBanner] = useState<PhotoBannerKey | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [denied, setDenied] = useState<PickDenied>(null);
  const [commitBusy, setCommitBusy] = useState(false);

  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;
  const lastWriteRef = useRef(lastWrite);
  lastWriteRef.current = lastWrite;
  const lastFailureRef = useRef<QueryFailureKind | null>(null);
  const commitBusyRef = useRef(false);
  const commitQueuedRef = useRef(false);
  const runningRef = useRef(new Set<string>());
  const handshakeRef = useRef(new Map<string, Handshake>());
  const pickMetaRef = useRef(new Map<string, PickedPhoto>());
  const nextLocalRef = useRef(1);
  const hydratedIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      for (const handshake of handshakeRef.current.values()) {
        handshake.abort.abort();
      }
    };
  }, []);

  const query = useQuery(
    getProductQueryOptions({
      client: canWrite ? apiClient : null,
      companyId: activeCompanyId,
      productId,
      getActiveCompany: () => apiClient?.getActiveCompany() ?? null,
    }),
  );

  useEffect(() => {
    if (query.data === undefined) {
      return;
    }
    if (hydratedIdRef.current === query.data.id) {
      return;
    }
    hydratedIdRef.current = query.data.id;
    const next = query.data.imageFileIds;
    setSlots(
      next.map((fileId) => ({
        kind: "committed" as const,
        id: fileId,
        fileId,
        localUri: null,
      })),
    );
    setBaseline(next);
    setLastWrite(null);
    lastFailureRef.current = null;
  }, [query.data]);

  const committedIds = slots
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

  const clientReady = apiClient !== null && activeCompanyId !== null;
  const state = classifyProductPhotosLoad({
    canWrite,
    productId,
    clientReady,
    status: query.status,
    failureKind: query.isError ? describeQueryFailure(query.error).kind : null,
  });
  const mutationFailure = mutation.isError
    ? describeQueryFailure(mutation.error).kind
    : null;
  const bannerKey: PhotoBannerKey | null =
    localBanner ??
    mapPhotoFailure(mutationFailure) ??
    (mutationFailure === null ? null : "commit");
  const banner = resolvePhotoBanner(copy.photos, bannerKey);
  const tiles = toPhotoTiles(slots);

  function portsFor(): ProductPhotoUploadPorts {
    return {
      prepare: (localUri) => {
        const slot = slotsRef.current.find(
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
    const next = patchUploadMachine(slotsRef.current, id, machine);
    slotsRef.current = next;
    if (mountedRef.current) {
      setSlots(next);
    }
  }

  async function commitIfNeeded(): Promise<void> {
    if (commitBusyRef.current) {
      commitQueuedRef.current = true;
      return;
    }
    commitBusyRef.current = true;
    if (mountedRef.current) {
      setCommitBusy(true);
    }
    try {
      do {
        commitQueuedRef.current = false;
        const plan = planPhotoCommit({
          productId,
          slots: slotsRef.current,
          lastCommitted: baselineRef.current,
          lastWrite: lastWriteRef.current,
          lastFailureKind: lastFailureRef.current,
          canRetryAttempt: mutation.isError,
        });
        if (plan.kind === "noop") {
          mutation.reset();
          return;
        }
        if (plan.kind === "write") {
          lastWriteRef.current = plan.fileIds;
          if (mountedRef.current) {
            setLastWrite(plan.fileIds);
          }
        }
        const output =
          plan.kind === "write"
            ? await mutation.submit({
                productId: plan.productId,
                fileIds: plan.fileIds,
              })
            : await mutation.retry();
        lastFailureRef.current = null;
        const outputIds = [...output.fileIds];
        const next = applyCommitSuccess(slotsRef.current, outputIds);
        slotsRef.current = next;
        baselineRef.current = outputIds;
        if (mountedRef.current) {
          setSlots(next);
          setBaseline(outputIds);
        }
        mutation.reset();
        await invalidateCatalogAfterStatusWrite({
          queryClient,
          companyId: activeCompanyId,
        });
      } while (readQueued(commitQueuedRef));
    } catch (error: unknown) {
      lastFailureRef.current = describeQueryFailure(error).kind;
    } finally {
      commitBusyRef.current = false;
      if (mountedRef.current) {
        setCommitBusy(false);
      }
    }
  }

  async function runSlot(
    id: string,
    trigger: "start" | "retry",
  ): Promise<void> {
    if (runningRef.current.has(id)) {
      return;
    }
    const slot = slotsRef.current.find((item) => item.id === id);
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
      const stillPresent = slotsRef.current.some(
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
      if (result.machine.phase === "failed") {
        if (mountedRef.current) {
          setLocalBanner(mapUploadBanner(result.machine.failure));
        }
      }
    } finally {
      runningRef.current.delete(id);
    }
  }

  function kickIdleUploads(): void {
    for (const slot of idleUploadSlots(slotsRef.current)) {
      void runSlot(slot.id, "start");
    }
  }

  function openPicker(): void {
    if (remainingPhotoSlots(slotsRef.current) < 1) {
      setLocalBanner("too_many");
      return;
    }
    mutation.reset();
    setLocalBanner(null);
    setDenied(null);
    setPickerOpen(true);
  }

  async function pickFrom(source: "camera" | "library"): Promise<void> {
    setPickerOpen(false);
    const remaining = remainingPhotoSlots(slotsRef.current);
    const result = await pickProductPhotos(source, remaining);
    if (result.kind === "canceled") {
      return;
    }
    if (result.kind === "denied") {
      setDenied(result.source);
      return;
    }
    const photos = result.photos.map((photo) => {
      const id = `local-${String(nextLocalRef.current)}`;
      nextLocalRef.current += 1;
      pickMetaRef.current.set(id, photo);
      return { id, localUri: photo.uri };
    });
    const added = addUploadSlots(slotsRef.current, photos);
    slotsRef.current = added.slots;
    setSlots(added.slots);
    if (added.added < photos.length) {
      setLocalBanner("too_many");
    }
    kickIdleUploads();
  }

  function cancelUpload(id: string): void {
    handshakeRef.current.get(id)?.abort.abort();
    handshakeRef.current.delete(id);
    pickMetaRef.current.delete(id);
    runningRef.current.delete(id);
    const next = removePhotoSlot(slotsRef.current, id);
    slotsRef.current = next;
    setSlots(next);
    // Ready uploads may already be in an in-flight replace; re-plan so a
    // dropped fileId is not left on the product.
    void commitIfNeeded();
  }

  function removePhoto(id: string): void {
    const slot = slotsRef.current.find((item) => item.id === id);
    if (slot?.kind === "upload") {
      cancelUpload(id);
      return;
    }
    const next = removePhotoSlot(slotsRef.current, id);
    slotsRef.current = next;
    setSlots(next);
    void commitIfNeeded();
  }

  function movePhoto(id: string, direction: "earlier" | "later"): void {
    const next = movePhotoSlot(slotsRef.current, id, direction);
    slotsRef.current = next;
    setSlots(next);
    void commitIfNeeded();
  }

  return {
    copy,
    state,
    tiles,
    previewByFileId,
    banner,
    pickerOpen,
    denied,
    canAdd: remainingPhotoSlots(slots) > 0 && state.kind === "ready",
    canRetryCommit: mutation.isError && state.kind === "ready",
    commitPending: commitBusy || mutation.isPending,
    headerTitle: copy.photos.title,
    goBack: () => {
      router.back();
    },
    retry: () => {
      void query.refetch();
    },
    retryCommit: () => {
      setLocalBanner(null);
      void commitIfNeeded();
    },
    openPicker,
    closePicker: () => {
      setPickerOpen(false);
    },
    pickCamera: () => {
      void pickFrom("camera");
    },
    pickLibrary: () => {
      void pickFrom("library");
    },
    closeDenied: () => {
      setDenied(null);
    },
    removePhoto,
    moveEarlier: (id: string) => {
      movePhoto(id, "earlier");
    },
    moveLater: (id: string) => {
      movePhoto(id, "later");
    },
    retryUpload: (id: string) => {
      setLocalBanner(null);
      const slot = slotsRef.current.find((item) => item.id === id);
      if (slot?.kind === "upload") {
        updateMachine(id, slot.machine);
        void runSlot(id, "retry");
      }
    },
    cancelUpload,
  };
}

function readQueued(ref: { current: boolean }): boolean {
  return ref.current;
}
