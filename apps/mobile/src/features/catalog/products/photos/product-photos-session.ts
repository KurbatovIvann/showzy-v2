/**
 * Product photo session (SHO-158). XState v6 owns picker, slots, the
 * commit queue, and flush planning. Hydrate from parent `imageFileIds`
 * — this module does not call `catalog.getProduct`. Per-image handshake
 * stays `reduceUpload` / `runProductPhotoUpload`.
 *
 * `createLogic` wraps the Zod-typed reducer. `createMachine` +
 * `schemas.events` hits `validator?: ActorLogicValidator` under
 * `exactOptionalPropertyTypes` and leaks `any` into the actor.
 */
import { createActor, createLogic } from "xstate";
import { z } from "zod";

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
} from "./product-photos-model";

const queryFailureKindSchema = z.enum([
  "validation",
  "unauthenticated",
  "permission",
  "not_found",
  "conflict",
  "confirmation",
  "rate_limited",
  "timeout",
  "internal",
  "network",
  "offline",
]);

const photoBannerKeySchema = z.enum([
  "network",
  "offline",
  "unavailable",
  "permission",
  "denied",
  "validation",
  "too_many",
  "commit",
]);

const uploadMachineSchema = z.object({
  phase: z.enum([
    "idle",
    "preparing",
    "requesting",
    "signing",
    "putting",
    "finalizing",
    "ready",
    "failed",
    "cancelled",
  ]),
  checkpoint: z.enum(["none", "prepared", "requested", "put"]),
  fileId: z.string().nullable(),
  progress: z.number(),
  failure: z
    .enum([
      "network",
      "offline",
      "validation",
      "permission",
      "not_found",
      "unavailable",
    ])
    .nullable(),
  reuseRequestOnRetry: z.boolean(),
});

const photoSlotSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("committed"),
    id: z.string(),
    fileId: z.string(),
    localUri: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("upload"),
    id: z.string(),
    localUri: z.string(),
    machine: uploadMachineSchema,
  }),
]);

const photoSessionContextSchema = z.object({
  productId: z.string().nullable(),
  requireProduct: z.boolean(),
  slots: z.array(photoSlotSchema),
  baseline: z.array(z.string()).nullable(),
  lastWrite: z.array(z.string()).nullable(),
  lastFailureKind: queryFailureKindSchema.nullable(),
  canRetryAttempt: z.boolean(),
  localBanner: photoBannerKeySchema.nullable(),
  pickerOpen: z.boolean(),
  commitBusy: z.boolean(),
  commitQueued: z.boolean(),
  hydratedKey: z.string().nullable(),
});

const photoSessionInputSchema = z.object({
  productId: z.string().nullable(),
  requireProduct: z.boolean(),
  snapshotFileIds: z.array(z.string()).nullable(),
});

const photoSessionEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hydrate"),
    productId: z.string().nullable(),
    imageFileIds: z.array(z.string()),
  }),
  z.object({
    type: z.literal("bindProductId"),
    productId: z.string(),
  }),
  z.object({ type: z.literal("openPicker") }),
  z.object({ type: z.literal("closePicker") }),
  z.object({ type: z.literal("pickDenied") }),
  z.object({ type: z.literal("pickCanceled") }),
  z.object({
    type: z.literal("addPhotos"),
    photos: z.array(
      z.object({
        id: z.string(),
        localUri: z.string(),
      }),
    ),
  }),
  z.object({ type: z.literal("removePhoto"), id: z.string() }),
  z.object({ type: z.literal("cancelUpload"), id: z.string() }),
  z.object({
    type: z.literal("movePhoto"),
    id: z.string(),
    direction: z.enum(["earlier", "later"]),
  }),
  z.object({
    type: z.literal("patchMachine"),
    id: z.string(),
    machine: uploadMachineSchema,
  }),
  z.object({
    type: z.literal("setBanner"),
    key: photoBannerKeySchema.nullable(),
  }),
  z.object({
    type: z.literal("setCanRetryAttempt"),
    value: z.boolean(),
  }),
  z.object({ type: z.literal("beginCommit") }),
  z.object({ type: z.literal("queueCommit") }),
  z.object({ type: z.literal("clearCommitQueue") }),
  z.object({
    type: z.literal("noteWrite"),
    fileIds: z.array(z.string()),
  }),
  z.object({ type: z.literal("commitNoop") }),
  z.object({
    type: z.literal("commitSucceeded"),
    fileIds: z.array(z.string()),
  }),
  z.object({
    type: z.literal("commitFailed"),
    kind: queryFailureKindSchema,
  }),
  z.object({ type: z.literal("finishCommit") }),
  z.object({ type: z.literal("clearFailure") }),
]);

export type PhotoSessionContext = z.infer<typeof photoSessionContextSchema>;
export type PhotoSessionInput = z.infer<typeof photoSessionInputSchema>;
export type PhotoSessionEvent = z.infer<typeof photoSessionEventSchema>;

function hydrateKey(productId: string | null, requireProduct: boolean): string {
  return requireProduct ? (productId ?? "unknown") : "create";
}

export function initialPhotoSessionContext(
  input: PhotoSessionInput,
): PhotoSessionContext {
  const snapshot = input.snapshotFileIds;
  return photoSessionContextSchema.parse({
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
  });
}

export function reducePhotoSession(
  context: PhotoSessionContext,
  event: PhotoSessionEvent,
): PhotoSessionContext {
  switch (event.type) {
    case "hydrate": {
      const key = hydrateKey(event.productId, context.requireProduct);
      if (context.hydratedKey === key) {
        return context;
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
): "ok" | "commit-failed" {
  return photoFlushOutcome({
    planKind: selectPhotoSessionCommitPlan(context).kind,
    lastFailureKind: context.lastFailureKind,
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

export const productPhotosSessionLogic = createLogic<
  PhotoSessionContext,
  unknown,
  typeof photoSessionInputSchema,
  PhotoSessionEvent
>({
  id: "productPhotos",
  schemas: {
    input: photoSessionInputSchema,
  },
  context: ({ input }) => initialPhotoSessionContext(input),
  run: ({ context, event }) => {
    const parsed = photoSessionEventSchema.safeParse(event);
    if (!parsed.success) {
      return;
    }
    return { context: reducePhotoSession(context, parsed.data) };
  },
});

export function startPhotoSession(input: PhotoSessionInput) {
  const actor = createActor(productPhotosSessionLogic, { input });
  actor.start();
  return actor;
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
