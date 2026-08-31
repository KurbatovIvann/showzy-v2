/**
 * Photo slot algebra and tile views (SHO-303). Pure — no React Native,
 * no Query. Commit planning is `product-photos-plan.ts`.
 */
import { SET_PRODUCT_IMAGES_MAX } from "./product-photos-limits";
import {
  initialUploadMachine,
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
