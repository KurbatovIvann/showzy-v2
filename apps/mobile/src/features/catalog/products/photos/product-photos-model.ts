/**
 * Pure view-model for product photo attach (SHO-141). No React Native
 * imports so ordering, the image cap, commit planning, and copy mapping
 * stay unit-testable.
 */
import type { QueryFailureKind } from "../../../../api/errors";
import type { ProductsPhotosCopy } from "../../../../i18n/products";
import { classifyProductDetail } from "../shared/classify-product-load";
import {
  MAX_UPLOAD_BYTES,
  PHOTO_MAX_EDGE,
  PHOTO_MIN_COMPRESS,
  PHOTO_MIN_EDGE,
  SET_PRODUCT_IMAGES_MAX,
} from "./product-photos-limits";
import {
  initialUploadMachine,
  type UploadFailureKind,
  type UploadMachine,
} from "./product-photos-upload";

export type PhotoSlot =
  | {
      readonly kind: "committed";
      readonly id: string;
      readonly fileId: string;
      readonly localUri: string | null;
    }
  | {
      readonly kind: "upload";
      readonly id: string;
      readonly localUri: string;
      readonly machine: UploadMachine;
    };

export type PhotoTilePhase = "ready" | "uploading" | "failed";

export type PhotoTileView = {
  readonly id: string;
  readonly fileId: string | null;
  readonly localUri: string | null;
  readonly phase: PhotoTilePhase;
  readonly progress: number;
  readonly isCover: boolean;
  readonly canMoveEarlier: boolean;
  readonly canMoveLater: boolean;
  readonly canRetry: boolean;
  readonly canCancel: boolean;
};

export type ProductPhotosLoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "not-found" }
  | { readonly kind: "permission" }
  | { readonly kind: "ready" };

export type PhotoBannerKey =
  | "network"
  | "offline"
  | "unavailable"
  | "permission"
  | "denied"
  | "validation"
  | "too_many"
  | "commit";

export type PhotoCommitPlan =
  | { readonly kind: "noop" }
  | { readonly kind: "retry" }
  | {
      readonly kind: "write";
      readonly productId: string;
      readonly fileIds: readonly string[];
    };

export type CatalogImageStrategy =
  "keep-jpeg" | "keep-png" | "keep-webp" | "convert-jpeg";

export type CatalogImagePreparePlan =
  { readonly kind: "keep" } | { readonly kind: "compress" };

export type PhotoCompressPlan =
  | { readonly kind: "ok" }
  | { readonly kind: "again"; readonly edge: number; readonly compress: number }
  | { readonly kind: "fail" };

const RETRYABLE_FAILURE: ReadonlySet<QueryFailureKind> = new Set([
  "network",
  "offline",
  "timeout",
  "rate_limited",
  "internal",
]);

export function classifyProductPhotosLoad(args: {
  readonly canWrite: boolean;
  readonly productId: string | null;
  readonly requireProduct: boolean;
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
}): ProductPhotosLoadState {
  if (!args.canWrite) {
    return { kind: "permission" };
  }
  if (!args.requireProduct) {
    if (!args.clientReady) {
      return { kind: "error" };
    }
    return { kind: "ready" };
  }
  return classifyProductDetail({
    productId: args.productId,
    clientReady: args.clientReady,
    status: args.status,
    failureKind: args.failureKind,
  });
}

const IN_FLIGHT_PHASES: ReadonlySet<UploadMachine["phase"]> = new Set([
  "idle",
  "preparing",
  "requesting",
  "signing",
  "putting",
  "finalizing",
]);

/** True while a local file is still in the handshake and must not unmount. */
export function hasInFlightPhotoUploads(slots: readonly PhotoSlot[]): boolean {
  return slots.some(
    (slot) =>
      slot.kind === "upload" && IN_FLIGHT_PHASES.has(slot.machine.phase),
  );
}

/**
 * True when a non-dropped upload is failed or still not ready. Flush must
 * not report success while a picked photo is missing from the ready list.
 */
export function hasUnreadyPhotoUploads(slots: readonly PhotoSlot[]): boolean {
  return slots.some(
    (slot) =>
      slot.kind === "upload" &&
      !isDropped(slot) &&
      slot.machine.phase !== "ready",
  );
}

/**
 * Create/edit leave-guard: local picks, in-flight uploads, or an ordered
 * list that has not been written yet. Edit auto-commit clears this after
 * `setProductImages` succeeds.
 */
export function photosAreDirty(
  slots: readonly PhotoSlot[],
  lastCommitted: readonly string[] | null,
): boolean {
  if (hasInFlightPhotoUploads(slots)) {
    return true;
  }
  if (slots.some((slot) => slot.kind === "upload" && !isDropped(slot))) {
    return true;
  }
  if (lastCommitted === null) {
    return slotsTowardCap(slots) > 0;
  }
  return !fileIdsEqual(readyOrderedFileIds(slots), lastCommitted);
}

export function committedSlotsFromFileIds(
  fileIds: readonly string[],
): readonly PhotoSlot[] {
  return fileIds.map((fileId) => ({
    kind: "committed" as const,
    id: fileId,
    fileId,
    localUri: null,
  }));
}

export function slotsTowardCap(slots: readonly PhotoSlot[]): number {
  return slots.filter((slot) => slot.kind === "committed" || !isDropped(slot))
    .length;
}

export function canAddPhoto(slots: readonly PhotoSlot[]): boolean {
  return slotsTowardCap(slots) < SET_PRODUCT_IMAGES_MAX;
}

export function addUploadSlots(
  slots: readonly PhotoSlot[],
  photos: readonly { readonly id: string; readonly localUri: string }[],
): { readonly slots: readonly PhotoSlot[]; readonly added: number } {
  const next = [...slots];
  let added = 0;
  for (const photo of photos) {
    if (slotsTowardCap(next) >= SET_PRODUCT_IMAGES_MAX) {
      break;
    }
    if (next.some((slot) => slot.id === photo.id)) {
      continue;
    }
    next.push({
      kind: "upload",
      id: photo.id,
      localUri: photo.localUri,
      machine: initialUploadMachine(),
    });
    added += 1;
  }
  return { slots: next, added };
}

export function removePhotoSlot(
  slots: readonly PhotoSlot[],
  id: string,
): readonly PhotoSlot[] {
  return slots.filter((slot) => slot.id !== id);
}

export function movePhotoSlot(
  slots: readonly PhotoSlot[],
  id: string,
  direction: "earlier" | "later",
): readonly PhotoSlot[] {
  const index = slots.findIndex((slot) => slot.id === id);
  if (index < 0) {
    return slots;
  }
  const swapWith = direction === "earlier" ? index - 1 : index + 1;
  const left = slots[index];
  const right = slots[swapWith];
  if (left === undefined || right === undefined) {
    return slots;
  }
  const next = [...slots];
  next[index] = right;
  next[swapWith] = left;
  return next;
}

export function patchUploadMachine(
  slots: readonly PhotoSlot[],
  id: string,
  machine: UploadMachine,
): readonly PhotoSlot[] {
  return slots.map((slot) => {
    if (slot.kind !== "upload" || slot.id !== id) {
      return slot;
    }
    return { ...slot, machine };
  });
}

export function readyOrderedFileIds(slots: readonly PhotoSlot[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const slot of slots) {
    const fileId = readyFileId(slot);
    if (fileId === null || seen.has(fileId)) {
      continue;
    }
    seen.add(fileId);
    ids.push(fileId);
  }
  return ids;
}

export function idleUploadSlots(
  slots: readonly PhotoSlot[],
): readonly PhotoSlot[] {
  return slots.filter(
    (slot) => slot.kind === "upload" && slot.machine.phase === "idle",
  );
}

export function applyCommitSuccess(
  slots: readonly PhotoSlot[],
  fileIds: readonly string[],
): readonly PhotoSlot[] {
  const committed = new Set(fileIds);
  const next: PhotoSlot[] = [];
  const used = new Set<string>();
  for (const slot of slots) {
    if (isDropped(slot)) {
      continue;
    }
    const fileId = readyFileId(slot);
    if (fileId !== null && committed.has(fileId) && !used.has(fileId)) {
      next.push({
        kind: "committed",
        id: fileId,
        fileId,
        localUri: slot.localUri,
      });
      used.add(fileId);
      continue;
    }
    if (slot.kind === "upload") {
      next.push(slot);
    }
  }
  return next;
}

export function fileIdsEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((id, index) => id === right[index]);
}

export function planPhotoCommit(args: {
  readonly productId: string | null;
  readonly slots: readonly PhotoSlot[];
  readonly lastCommitted: readonly string[] | null;
  readonly lastWrite: readonly string[] | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly canRetryAttempt: boolean;
}): PhotoCommitPlan {
  if (args.productId === null) {
    return { kind: "noop" };
  }
  const fileIds = readyOrderedFileIds(args.slots);
  const retryable =
    args.lastFailureKind !== null &&
    RETRYABLE_FAILURE.has(args.lastFailureKind);
  if (
    args.canRetryAttempt &&
    args.lastWrite !== null &&
    fileIdsEqual(args.lastWrite, fileIds) &&
    retryable
  ) {
    return { kind: "retry" };
  }
  if (
    args.lastCommitted !== null &&
    fileIdsEqual(args.lastCommitted, fileIds)
  ) {
    return { kind: "noop" };
  }
  return {
    kind: "write",
    productId: args.productId,
    fileIds,
  };
}

export type PhotoFlushOutcome = "ok" | "commit-failed" | "upload-failed";

/**
 * After `commitIfNeeded`, save may still `flush`. Matching ready ids are
 * not enough: a failed or otherwise unready pick is `"upload-failed"`.
 * If the user removed that pick so ready ids match the server, a prior
 * replace failure may still be `"ok"` (undo).
 */
export function photoFlushOutcome(args: {
  readonly planKind: PhotoCommitPlan["kind"];
  readonly lastFailureKind: QueryFailureKind | null;
  readonly slots: readonly PhotoSlot[];
}): PhotoFlushOutcome {
  if (hasUnreadyPhotoUploads(args.slots)) {
    return "upload-failed";
  }
  if (args.planKind === "noop") {
    return "ok";
  }
  return args.lastFailureKind === null ? "ok" : "commit-failed";
}

export function toPhotoTiles(
  slots: readonly PhotoSlot[],
): readonly PhotoTileView[] {
  const visible = slots.filter((slot) => !isDropped(slot));
  return visible.map((slot, index) => {
    const last = index === visible.length - 1;
    if (slot.kind === "committed") {
      return {
        id: slot.id,
        fileId: slot.fileId,
        localUri: slot.localUri,
        phase: "ready",
        progress: 1,
        isCover: index === 0,
        canMoveEarlier: index > 0,
        canMoveLater: !last,
        canRetry: false,
        canCancel: false,
      };
    }
    const failed = slot.machine.phase === "failed";
    const ready = slot.machine.phase === "ready";
    return {
      id: slot.id,
      fileId: slot.machine.fileId,
      localUri: slot.localUri,
      phase: failed ? "failed" : ready ? "ready" : "uploading",
      progress: slot.machine.progress,
      isCover: index === 0,
      canMoveEarlier: index > 0,
      canMoveLater: !last,
      canRetry: failed,
      canCancel: !failed && !ready && slot.machine.phase !== "idle",
    };
  });
}

export function mapDeniedBanner(
  source: "camera" | "library" | null,
): PhotoBannerKey | null {
  return source === null ? null : "denied";
}

export function mapPhotoFailure(
  kind: QueryFailureKind | null,
): PhotoBannerKey | null {
  if (kind === null) {
    return null;
  }
  if (kind === "permission") {
    return "permission";
  }
  if (kind === "validation") {
    return "validation";
  }
  if (kind === "network") {
    return "network";
  }
  if (kind === "offline") {
    return "offline";
  }
  return "unavailable";
}

export function mapUploadBanner(
  reason: UploadFailureKind | null,
): PhotoBannerKey | null {
  if (reason === null) {
    return null;
  }
  if (reason === "permission") {
    return "permission";
  }
  if (reason === "validation") {
    return "validation";
  }
  if (reason === "network") {
    return "network";
  }
  if (reason === "offline") {
    return "offline";
  }
  return "unavailable";
}

export function resolvePhotoBanner(
  copy: ProductsPhotosCopy,
  key: PhotoBannerKey | null,
): string | null {
  if (key === null) {
    return null;
  }
  return copy.errors[key];
}

/**
 * Photo-strip banner precedence: local session, then commit mutation,
 * then `files.getDownloadUrls` (never treat a download error as success
 * with empty preview URLs).
 */
export function resolveProductPhotosBannerKey(args: {
  readonly localBanner: PhotoBannerKey | null;
  readonly mutationFailure: QueryFailureKind | null;
  readonly downloadFailure: QueryFailureKind | null;
}): PhotoBannerKey | null {
  if (args.localBanner !== null) {
    return args.localBanner;
  }
  const mutationBanner = mapPhotoFailure(args.mutationFailure);
  if (mutationBanner !== null) {
    return mutationBanner;
  }
  if (args.mutationFailure !== null) {
    return "commit";
  }
  return mapPhotoFailure(args.downloadFailure);
}

export function catalogImageStrategy(
  mimeType: string | undefined,
  fileName: string | undefined,
): CatalogImageStrategy {
  const mime = (mimeType ?? "").toLowerCase();
  const name = (fileName ?? "").toLowerCase();
  if (mime === "image/jpeg" || mime === "image/jpg") {
    return "keep-jpeg";
  }
  if (mime === "image/png") {
    return "keep-png";
  }
  if (mime === "image/webp") {
    return "keep-webp";
  }
  if (
    mime === "image/heic" ||
    mime === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  ) {
    return "convert-jpeg";
  }
  if (name.endsWith(".png")) {
    return "keep-png";
  }
  if (name.endsWith(".webp")) {
    return "keep-webp";
  }
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return "keep-jpeg";
  }
  return "convert-jpeg";
}

/**
 * JPEG/PNG/WebP stay as-is only when already in-cap and ≤ PHOTO_MAX_EDGE.
 * Size ≤ 10 MiB is not enough — camera JPEGs are 3–8 MiB at 4032px.
 * HEIC / unknown always convert (SHO-245).
 */
export function catalogImagePreparePlan(args: {
  readonly strategy: CatalogImageStrategy;
  readonly byteSize: number;
  readonly longEdge: number;
}): CatalogImagePreparePlan {
  if (args.strategy === "convert-jpeg") {
    return { kind: "compress" };
  }
  if (args.byteSize < 1 || args.byteSize > MAX_UPLOAD_BYTES) {
    return { kind: "compress" };
  }
  if (args.longEdge > PHOTO_MAX_EDGE) {
    return { kind: "compress" };
  }
  return { kind: "keep" };
}

export function nextPhotoCompressPlan(args: {
  readonly byteSize: number;
  readonly edge: number;
  readonly compress: number;
}): PhotoCompressPlan {
  if (args.byteSize >= 1 && args.byteSize <= MAX_UPLOAD_BYTES) {
    return { kind: "ok" };
  }
  const atFloor =
    args.edge <= PHOTO_MIN_EDGE && args.compress <= PHOTO_MIN_COMPRESS;
  if (atFloor) {
    return { kind: "fail" };
  }
  return {
    kind: "again",
    edge: Math.max(PHOTO_MIN_EDGE, Math.floor(args.edge * 0.75)),
    compress: Math.max(PHOTO_MIN_COMPRESS, roundCompress(args.compress - 0.14)),
  };
}

export function remainingPhotoSlots(slots: readonly PhotoSlot[]): number {
  return Math.max(0, SET_PRODUCT_IMAGES_MAX - slotsTowardCap(slots));
}

function readyFileId(slot: PhotoSlot): string | null {
  if (slot.kind === "committed") {
    return slot.fileId;
  }
  if (slot.machine.phase === "ready" && slot.machine.fileId !== null) {
    return slot.machine.fileId;
  }
  return null;
}

function isDropped(slot: PhotoSlot): boolean {
  return slot.kind === "upload" && slot.machine.phase === "cancelled";
}

function roundCompress(value: number): number {
  return Math.round(value * 100) / 100;
}

export { PHOTO_MAX_EDGE, SET_PRODUCT_IMAGES_MAX };
