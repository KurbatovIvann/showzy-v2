/**
 * Product photo session (SHO-162). `reducePhotoSession` owns picker,
 * slots, the commit queue, and flush planning. React drives it with
 * `useReducer`; tests and I/O ports use `createPhotoSessionStore`.
 * Hydrate from parent `imageFileIds` — this module does not call
 * `catalog.getProduct`. Per-image handshake stays `reduceUpload` /
 * `runProductPhotoUpload`.
 *
 * Events are typed TypeScript unions (SHO-302). Do not Zod-parse
 * internal reducer events: a schema miss used to `safeParse` and
 * silently drop the event. Validation belongs at a real I/O boundary.
 */
import type { QueryFailureKind } from "../../../../api/errors";
import {
  addUploadSlots,
  applyCommitSuccess,
  committedSlotsFromFileIds,
  hasInFlightPhotoUploads,
  idleUploadSlots,
  movePhotoSlot,
  photoFlushOutcome,
  photosAreDirty,
  planPhotoCommit,
  remainingPhotoSlots,
  removePhotoSlot,
  patchUploadMachine,
  toPhotoTiles,
  type PhotoBannerKey,
  type PhotoFlushOutcome,
  type PhotoSlot,
} from "./product-photos-model";
import type { UploadMachine } from "./product-photos-upload";

export type PhotoSessionContext = {
  readonly productId: string | null;
  readonly requireProduct: boolean;
  readonly slots: readonly PhotoSlot[];
  readonly baseline: readonly string[] | null;
  readonly lastWrite: readonly string[] | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly canRetryAttempt: boolean;
  readonly localBanner: PhotoBannerKey | null;
  readonly pickerOpen: boolean;
  readonly commitBusy: boolean;
  readonly commitQueued: boolean;
  readonly hydratedKey: string | null;
};

export type PhotoSessionInput = {
  readonly productId: string | null;
  readonly requireProduct: boolean;
  readonly snapshotFileIds: readonly string[] | null;
};

export type PhotoSessionEvent =
  | {
      readonly type: "hydrate";
      readonly productId: string | null;
      readonly imageFileIds: readonly string[];
    }
  | { readonly type: "bindProductId"; readonly productId: string }
  | { readonly type: "openPicker" }
  | { readonly type: "closePicker" }
  | { readonly type: "pickDenied" }
  | { readonly type: "pickCanceled" }
  | {
      readonly type: "addPhotos";
      readonly photos: ReadonlyArray<{
        readonly id: string;
        readonly localUri: string;
      }>;
    }
  | { readonly type: "removePhoto"; readonly id: string }
  | { readonly type: "cancelUpload"; readonly id: string }
  | {
      readonly type: "movePhoto";
      readonly id: string;
      readonly direction: "earlier" | "later";
    }
  | {
      readonly type: "patchMachine";
      readonly id: string;
      readonly machine: UploadMachine;
    }
  | { readonly type: "setBanner"; readonly key: PhotoBannerKey | null }
  | { readonly type: "setCanRetryAttempt"; readonly value: boolean }
  | { readonly type: "beginCommit" }
  | { readonly type: "queueCommit" }
  | { readonly type: "clearCommitQueue" }
  | { readonly type: "noteWrite"; readonly fileIds: readonly string[] }
  | { readonly type: "commitNoop" }
  | {
      readonly type: "commitSucceeded";
      readonly fileIds: readonly string[];
    }
  | { readonly type: "commitFailed"; readonly kind: QueryFailureKind }
  | { readonly type: "finishCommit" }
  | { readonly type: "clearFailure" };

export function snapshotFileIdsFromArgs(args: {
  readonly imageFileIds?: readonly string[] | undefined;
  readonly requireProduct: boolean;
}): string[] | null {
  if (args.imageFileIds !== undefined) {
    return [...args.imageFileIds];
  }
  return args.requireProduct ? null : [];
}

function hydrateKey(productId: string | null, requireProduct: boolean): string {
  return requireProduct ? (productId ?? "unknown") : "create";
}

function sameFileIdList(
  left: readonly string[] | null,
  right: readonly string[],
): boolean {
  if (left === null || left.length !== right.length) {
    return false;
  }
  return left.every((id, index) => id === right[index]);
}

export function initialPhotoSessionContext(
  input: PhotoSessionInput,
): PhotoSessionContext {
  const snapshot = input.snapshotFileIds;
  return {
    productId: input.productId,
    requireProduct: input.requireProduct,
    slots: snapshot === null ? [] : [...committedSlotsFromFileIds(snapshot)],
    baseline: snapshot === null ? null : [...snapshot],
    lastWrite: null,
    lastFailureKind: null,
    canRetryAttempt: false,
    localBanner: null,
    pickerOpen: false,
    commitBusy: false,
    commitQueued: false,
    hydratedKey:
      snapshot === null
        ? null
        : hydrateKey(input.productId, input.requireProduct),
  };
}

export function reducePhotoSession(
  context: PhotoSessionContext,
  event: PhotoSessionEvent,
): PhotoSessionContext {
  switch (event.type) {
    case "hydrate": {
      const key = hydrateKey(event.productId, context.requireProduct);
      /**
       * Single-device "session owns truth" (SHO-295 owner decision 5).
       * After the first hydrate for this product, in-progress local
       * edits are not overwritten by a later parent snapshot (another
       * device, or getProduct refetching while the user is rearranging
       * tiles). When the session is clean, adopt server ids that
       * differ so our own commit invalidation can refresh the strip.
       */
      if (context.hydratedKey === key) {
        if (photosAreDirty(context.slots, context.baseline)) {
          return context;
        }
        if (sameFileIdList(context.baseline, event.imageFileIds)) {
          return context;
        }
      }
      return {
        ...context,
        productId: event.productId ?? context.productId,
        slots: [...committedSlotsFromFileIds(event.imageFileIds)],
        baseline: [...event.imageFileIds],
        lastWrite: null,
        lastFailureKind: null,
        hydratedKey: key,
      };
    }
    case "bindProductId":
      return { ...context, productId: event.productId };
    case "openPicker":
      if (remainingPhotoSlots(context.slots) < 1) {
        return { ...context, localBanner: "too_many" };
      }
      return { ...context, pickerOpen: true, localBanner: null };
    case "closePicker":
      return { ...context, pickerOpen: false };
    case "pickDenied":
      return { ...context, pickerOpen: false, localBanner: "denied" };
    case "pickCanceled":
      return { ...context, pickerOpen: false };
    case "addPhotos": {
      const added = addUploadSlots(context.slots, event.photos);
      return {
        ...context,
        slots: [...added.slots],
        pickerOpen: false,
        localBanner: added.added < event.photos.length ? "too_many" : null,
      };
    }
    case "removePhoto":
      return {
        ...context,
        slots: [...removePhotoSlot(context.slots, event.id)],
      };
    case "cancelUpload":
      return {
        ...context,
        slots: [...removePhotoSlot(context.slots, event.id)],
      };
    case "movePhoto":
      return {
        ...context,
        slots: [...movePhotoSlot(context.slots, event.id, event.direction)],
      };
    case "patchMachine":
      return {
        ...context,
        slots: [...patchUploadMachine(context.slots, event.id, event.machine)],
      };
    case "setBanner":
      return { ...context, localBanner: event.key };
    case "setCanRetryAttempt":
      return { ...context, canRetryAttempt: event.value };
    case "beginCommit":
      return { ...context, commitBusy: true };
    case "queueCommit":
      return { ...context, commitQueued: true };
    case "clearCommitQueue":
      return { ...context, commitQueued: false };
    case "noteWrite":
      return { ...context, lastWrite: [...event.fileIds] };
    case "commitNoop":
      return { ...context, lastFailureKind: null };
    case "commitSucceeded":
      return {
        ...context,
        slots: [...applyCommitSuccess(context.slots, event.fileIds)],
        baseline: [...event.fileIds],
        lastFailureKind: null,
      };
    case "commitFailed":
      return { ...context, lastFailureKind: event.kind };
    case "finishCommit":
      return { ...context, commitBusy: false };
    case "clearFailure":
      return { ...context, lastFailureKind: null };
  }
}

export function selectPhotoSessionCommitPlan(context: PhotoSessionContext) {
  return planPhotoCommit({
    productId: context.productId,
    slots: context.slots,
    lastCommitted: context.baseline,
    lastWrite: context.lastWrite,
    lastFailureKind: context.lastFailureKind,
    canRetryAttempt: context.canRetryAttempt,
  });
}

export function selectPhotoSessionFlushOutcome(
  context: PhotoSessionContext,
): PhotoFlushOutcome {
  return photoFlushOutcome({
    planKind: selectPhotoSessionCommitPlan(context).kind,
    lastFailureKind: context.lastFailureKind,
    slots: context.slots,
  });
}

export function selectPhotoSessionIdleIds(
  context: PhotoSessionContext,
): readonly string[] {
  return idleUploadSlots(context.slots).map((slot) => slot.id);
}

export function photoSessionIsBusy(context: PhotoSessionContext): boolean {
  return hasInFlightPhotoUploads(context.slots) || context.commitBusy;
}

export type PhotoSessionStore = {
  readonly getContext: () => PhotoSessionContext;
  readonly send: (event: PhotoSessionEvent) => void;
};

export function createPhotoSessionStore(
  input: PhotoSessionInput,
): PhotoSessionStore {
  let context = initialPhotoSessionContext(input);
  return {
    getContext: () => context,
    send: (event) => {
      context = reducePhotoSession(context, event);
    },
  };
}

export function photoSessionTiles(context: PhotoSessionContext) {
  return toPhotoTiles(context.slots);
}

export function photoSessionDirty(context: PhotoSessionContext): boolean {
  return photosAreDirty(context.slots, context.baseline);
}

export function photoSessionNeedsCommit(context: PhotoSessionContext): boolean {
  return selectPhotoSessionCommitPlan(context).kind !== "noop";
}
