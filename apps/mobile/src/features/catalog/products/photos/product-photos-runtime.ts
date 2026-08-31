/**
 * Imperative photo I/O for the session: per-slot handshake, native
 * picker, abort, and settle waiters. React stays in `use-product-photos`.
 */
import type { MutationAttempt } from "@showzy/contract";

import type { ContractClient } from "../../../../api/client";
import { requireReadyClient } from "../../../../api/errors";
import { waitForSheetHidden } from "../../../../components/ui/sheet-dismiss";
import { createMobileMutationAttempt } from "../../../../crypto/create-attempt";
import { mapUploadBanner } from "./product-photos-banners";
import { remainingPhotoSlots } from "./product-photos-slots";
import type {
  PickedPhoto,
  PickProductPhotosResult,
} from "./product-photos-native";
import {
  photoSessionIsBusy,
  selectPhotoSessionIdleIds,
  type PhotoSessionContext,
  type PhotoSessionEvent,
} from "./product-photos-session";
import {
  runProductPhotoUpload,
  type PreparedCatalogImage,
  type ProductPhotoUploadPorts,
} from "./product-photos-upload";

/** Low-end Android: cap native decode + hash buffers in flight (SHO-302). */
export const PHOTO_UPLOAD_MAX_IN_FLIGHT = 2;

type Handshake = {
  prepared: PreparedCatalogImage | null;
  requestAttempt: MutationAttempt | null;
  finalizeAttempt: MutationAttempt | null;
  abort: AbortController;
};

export type ProductPhotosRuntime = {
  abortAll: () => void;
  setMounted: (value: boolean) => void;
  kickIdleUploads: () => void;
  runSlot: (id: string, trigger: "start" | "retry") => Promise<void>;
  pickFrom: (source: "camera" | "library") => Promise<void>;
  cancelUpload: (id: string) => void;
  removePhoto: (id: string) => void;
  movePhoto: (id: string, direction: "earlier" | "later") => void;
  retryUpload: (id: string) => void;
  waitUntilSettled: () => Promise<void>;
  notifySettled: () => void;
  notifySheetHidden: () => void;
};

export type ProductPhotosRuntimeDeps = {
  getContext: () => PhotoSessionContext;
  send: (event: PhotoSessionEvent) => void;
  getClient: () => ContractClient | null;
  commitIfNeeded: () => Promise<void>;
  pickPhotos: (
    source: "camera" | "library",
    remaining: number,
  ) => Promise<PickProductPhotosResult>;
  prepareImage: (args: {
    readonly uri: string;
    readonly mimeType: string | undefined;
    readonly fileName: string | undefined;
  }) => Promise<PreparedCatalogImage>;
  putBytes: ProductPhotoUploadPorts["put"];
  waitUntilSheetHidden?: (hidden: Promise<void>) => Promise<void>;
  runUpload?: typeof runProductPhotoUpload;
};

function requireClient(client: ContractClient | null): ContractClient {
  return requireReadyClient(client);
}

export function createProductPhotosRuntime(
  deps: ProductPhotosRuntimeDeps,
): ProductPhotosRuntime {
  const pickPhotos = deps.pickPhotos;
  const prepareImage = deps.prepareImage;
  const putBytes = deps.putBytes;
  const waitUntilSheetHidden = deps.waitUntilSheetHidden ?? waitForSheetHidden;
  const runUpload = deps.runUpload ?? runProductPhotoUpload;

  const running = new Set<string>();
  const handshakes = new Map<string, Handshake>();
  const pickMeta = new Map<string, PickedPhoto>();
  let nextLocal = 1;
  let mounted = true;
  function isMounted(): boolean {
    return mounted;
  }
  let settleWaiters: Array<() => void> = [];
  let sheetHiddenWaiters: Array<() => void> = [];

  function photosBusy(): boolean {
    return photoSessionIsBusy(deps.getContext()) || running.size > 0;
  }

  function notifySettled(): void {
    if (photosBusy()) {
      return;
    }
    const waiters = settleWaiters;
    settleWaiters = [];
    for (const waiter of waiters) {
      waiter();
    }
  }

  function portsFor(): ProductPhotoUploadPorts {
    return {
      prepare: (localUri) => {
        const slot = deps
          .getContext()
          .slots.find(
            (item) => item.kind === "upload" && item.localUri === localUri,
          );
        const meta = slot === undefined ? undefined : pickMeta.get(slot.id);
        return prepareImage({
          uri: localUri,
          mimeType: meta?.mimeType,
          fileName: meta?.fileName,
        });
      },
      requestUpload: (input, options) =>
        requireClient(deps.getClient()).client.files.requestUpload(
          input,
          options,
        ),
      getUploadUrl: (input) =>
        requireClient(deps.getClient()).client.files.getUploadUrl(input),
      put: putBytes,
      finalize: (input, options) =>
        requireClient(deps.getClient()).client.files.finalizeUpload(
          input,
          options,
        ),
      createAttempt: createMobileMutationAttempt,
    };
  }

  async function runSlot(
    id: string,
    trigger: "start" | "retry",
  ): Promise<void> {
    if (!isMounted()) {
      return;
    }
    if (running.has(id)) {
      return;
    }
    const slot = deps.getContext().slots.find((item) => item.id === id);
    if (slot === undefined || slot.kind !== "upload") {
      return;
    }
    running.add(id);
    const existing = handshakes.get(id);
    const abort = new AbortController();
    const handshake: Handshake = {
      prepared: existing?.prepared ?? null,
      requestAttempt: existing?.requestAttempt ?? null,
      finalizeAttempt: existing?.finalizeAttempt ?? null,
      abort,
    };
    handshakes.set(id, handshake);
    try {
      const result = await runUpload({
        localUri: slot.localUri,
        state: slot.machine,
        trigger,
        ports: portsFor(),
        signal: abort.signal,
        prepared: handshake.prepared,
        requestAttempt: handshake.requestAttempt,
        finalizeAttempt: handshake.finalizeAttempt,
        onState: (machine) => {
          // Keep the live handshake object in the map. Spreading here
          // used to stash a dead copy whose prepared/attempt fields
          // never received the post-run assignments (SHO-302).
          deps.send({ type: "patchMachine", id, machine });
        },
      });
      handshake.prepared = result.prepared;
      handshake.requestAttempt = result.requestAttempt;
      handshake.finalizeAttempt = result.finalizeAttempt;
      const stillPresent = deps
        .getContext()
        .slots.some((item) => item.kind === "upload" && item.id === id);
      if (stillPresent) {
        deps.send({ type: "patchMachine", id, machine: result.machine });
      }
      const dropHandshake =
        !stillPresent ||
        result.machine.phase === "ready" ||
        result.machine.phase === "cancelled";
      if (dropHandshake) {
        handshakes.delete(id);
        pickMeta.delete(id);
      } else {
        handshakes.set(id, handshake);
      }
      if (result.machine.phase === "ready") {
        await deps.commitIfNeeded();
      }
      if (result.machine.phase === "failed" && isMounted()) {
        deps.send({
          type: "setBanner",
          key: mapUploadBanner(result.machine.failure),
        });
      }
    } finally {
      running.delete(id);
      kickIdleUploads();
      notifySettled();
    }
  }

  function kickIdleUploads(): void {
    if (!isMounted()) {
      return;
    }
    for (const id of selectPhotoSessionIdleIds(deps.getContext())) {
      if (running.size >= PHOTO_UPLOAD_MAX_IN_FLIGHT) {
        break;
      }
      void runSlot(id, "start");
    }
  }

  function notifySheetHidden(): void {
    const waiters = sheetHiddenWaiters;
    sheetHiddenWaiters = [];
    for (const waiter of waiters) {
      waiter();
    }
  }

  function waitUntilSourceSheetHidden(): Promise<void> {
    return waitUntilSheetHidden(
      new Promise<void>((resolve) => {
        sheetHiddenWaiters.push(resolve);
      }),
    );
  }

  async function pickFrom(source: "camera" | "library"): Promise<void> {
    const hidden = waitUntilSourceSheetHidden();
    deps.send({ type: "closePicker" });
    await hidden;
    const remaining = remainingPhotoSlots(deps.getContext().slots);
    const result = await pickPhotos(source, remaining);
    if (result.kind === "canceled") {
      deps.send({ type: "pickCanceled" });
      notifySettled();
      return;
    }
    if (result.kind === "denied") {
      deps.send({ type: "pickDenied" });
      notifySettled();
      return;
    }
    const photos = result.photos.map((photo) => {
      const id = `local-${String(nextLocal)}`;
      nextLocal += 1;
      pickMeta.set(id, photo);
      return { id, localUri: photo.uri };
    });
    deps.send({ type: "addPhotos", photos });
    kickIdleUploads();
    notifySettled();
  }

  function cancelUpload(id: string): void {
    handshakes.get(id)?.abort.abort();
    handshakes.delete(id);
    pickMeta.delete(id);
    running.delete(id);
    deps.send({ type: "cancelUpload", id });
    notifySettled();
    void deps.commitIfNeeded();
  }

  function removePhoto(id: string): void {
    const slot = deps.getContext().slots.find((item) => item.id === id);
    if (slot?.kind === "upload") {
      cancelUpload(id);
      return;
    }
    deps.send({ type: "removePhoto", id });
    void deps.commitIfNeeded();
  }

  function movePhoto(id: string, direction: "earlier" | "later"): void {
    deps.send({ type: "movePhoto", id, direction });
    void deps.commitIfNeeded();
  }

  function retryUpload(id: string): void {
    deps.send({ type: "setBanner", key: null });
    const slot = deps.getContext().slots.find((item) => item.id === id);
    if (slot?.kind === "upload") {
      void runSlot(id, "retry");
    }
  }

  function waitUntilSettled(): Promise<void> {
    if (!photosBusy()) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      settleWaiters.push(resolve);
    });
  }

  return {
    abortAll: () => {
      for (const handshake of handshakes.values()) {
        handshake.abort.abort();
      }
    },
    setMounted: (value) => {
      mounted = value;
    },
    kickIdleUploads,
    runSlot,
    pickFrom,
    cancelUpload,
    removePhoto,
    movePhoto,
    retryUpload,
    waitUntilSettled,
    notifySettled,
    notifySheetHidden,
  };
}
