import { describe, expect, it } from "vitest";

import {
  addUploadSlots,
  applyCommitSuccess,
  canAddPhoto,
  catalogImageStrategy,
  committedSlotsFromFileIds,
  classifyProductPhotosLoad,
  fileIdsEqual,
  movePhotoSlot,
  nextPhotoCompressPlan,
  planPhotoCommit,
  readyOrderedFileIds,
  remainingPhotoSlots,
  removePhotoSlot,
  toPhotoTiles,
  SET_PRODUCT_IMAGES_MAX,
} from "./product-photos-model";
import {
  MAX_UPLOAD_BYTES,
  PHOTO_MAX_EDGE,
  PHOTO_MIN_COMPRESS,
  PHOTO_MIN_EDGE,
} from "./product-photos-limits";
import { initialUploadMachine, reduceUpload } from "./product-photos-upload";

const FILE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FILE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FILE_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PRODUCT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

function uploadSlot(
  id: string,
  phase: "idle" | "ready" | "failed" = "idle",
  fileId: string | null = null,
) {
  let machine = initialUploadMachine();
  if (phase === "ready" && fileId !== null) {
    machine = reduceUpload(machine, { type: "start" }).state;
    machine = reduceUpload(machine, { type: "prepared" }).state;
    machine = reduceUpload(machine, { type: "requested", fileId }).state;
    machine = reduceUpload(machine, { type: "signed" }).state;
    machine = reduceUpload(machine, { type: "put" }).state;
    machine = reduceUpload(machine, { type: "finalized" }).state;
  }
  if (phase === "failed") {
    machine = reduceUpload(machine, { type: "start" }).state;
    machine = reduceUpload(machine, { type: "fail", reason: "network" }).state;
  }
  return {
    kind: "upload" as const,
    id,
    localUri: `file:///tmp/${id}.jpg`,
    machine,
  };
}

describe("product photo ordering", () => {
  it("hydrates committed slots from catalog.getProduct fileIds", () => {
    const slots = committedSlotsFromFileIds([FILE_A, FILE_B]);
    expect(readyOrderedFileIds(slots)).toEqual([FILE_A, FILE_B]);
    expect(toPhotoTiles(slots)[0]?.isCover).toBe(true);
    expect(toPhotoTiles(slots)[1]?.isCover).toBe(false);
  });

  it("appends new uploads up to the contract cap of 10", () => {
    const filled = committedSlotsFromFileIds(
      Array.from({ length: SET_PRODUCT_IMAGES_MAX }, (_, index) => {
        const n = index.toString(16).padStart(12, "0");
        return `aaaaaaaa-aaaa-4aaa-8aaa-${n}`;
      }),
    );
    expect(canAddPhoto(filled)).toBe(false);
    expect(remainingPhotoSlots(filled)).toBe(0);
    const extra = addUploadSlots(filled, [
      { id: "local-1", localUri: "file:///tmp/x.jpg" },
    ]);
    expect(extra.added).toBe(0);
    expect(extra.slots).toHaveLength(SET_PRODUCT_IMAGES_MAX);
  });

  it("adds, removes, and reorders slots, skipping in-flight ids on commit", () => {
    const start = committedSlotsFromFileIds([FILE_A, FILE_B]);
    const withLocal = addUploadSlots(start, [
      { id: "local-1", localUri: "file:///tmp/n.jpg" },
    ]).slots;
    expect(readyOrderedFileIds(withLocal)).toEqual([FILE_A, FILE_B]);
    const moved = movePhotoSlot(withLocal, FILE_B, "earlier");
    expect(readyOrderedFileIds(moved)).toEqual([FILE_B, FILE_A]);
    const removed = removePhotoSlot(moved, FILE_A);
    expect(readyOrderedFileIds(removed)).toEqual([FILE_B]);
    const ready = [
      ...committedSlotsFromFileIds([FILE_B]),
      uploadSlot("local-1", "ready", FILE_C),
    ];
    expect(readyOrderedFileIds(ready)).toEqual([FILE_B, FILE_C]);
  });

  it("plans a replace write and retries the same ordered list", () => {
    const slots = committedSlotsFromFileIds([FILE_B, FILE_A]);
    expect(
      planPhotoCommit({
        productId: PRODUCT_ID,
        slots,
        lastCommitted: [FILE_A, FILE_B],
        lastWrite: null,
        lastFailureKind: null,
        canRetryAttempt: false,
      }),
    ).toEqual({
      kind: "write",
      productId: PRODUCT_ID,
      fileIds: [FILE_B, FILE_A],
    });
    expect(
      planPhotoCommit({
        productId: PRODUCT_ID,
        slots,
        lastCommitted: [FILE_A, FILE_B],
        lastWrite: [FILE_B, FILE_A],
        lastFailureKind: "network",
        canRetryAttempt: true,
      }),
    ).toEqual({ kind: "retry" });
    expect(
      planPhotoCommit({
        productId: PRODUCT_ID,
        slots,
        lastCommitted: [FILE_A, FILE_B],
        lastWrite: [FILE_B, FILE_A],
        lastFailureKind: "network",
        canRetryAttempt: false,
      }),
    ).toEqual({
      kind: "write",
      productId: PRODUCT_ID,
      fileIds: [FILE_B, FILE_A],
    });
    expect(
      planPhotoCommit({
        productId: PRODUCT_ID,
        slots,
        lastCommitted: [FILE_B, FILE_A],
        lastWrite: [FILE_B, FILE_A],
        lastFailureKind: null,
        canRetryAttempt: false,
      }),
    ).toEqual({ kind: "noop" });
  });

  it("keeps in-flight uploads in place after a successful replace", () => {
    const slots = [
      ...committedSlotsFromFileIds([FILE_A]),
      uploadSlot("local-1"),
    ];
    const next = applyCommitSuccess(slots, [FILE_A]);
    expect(next.map((slot) => slot.id)).toEqual([FILE_A, "local-1"]);
    expect(next[1]?.kind).toBe("upload");
  });

  it("keeps a ready upload that was not in this replace so the next write can attach it", () => {
    const slots = [
      ...committedSlotsFromFileIds([FILE_A]),
      uploadSlot("local-1", "ready", FILE_C),
    ];
    const next = applyCommitSuccess(slots, [FILE_A]);
    expect(readyOrderedFileIds(next)).toEqual([FILE_A, FILE_C]);
    expect(next[1]).toMatchObject({ kind: "upload", id: "local-1" });
    expect(
      planPhotoCommit({
        productId: PRODUCT_ID,
        slots: next,
        lastCommitted: [FILE_A],
        lastWrite: [FILE_A],
        lastFailureKind: null,
        canRetryAttempt: false,
      }),
    ).toEqual({
      kind: "write",
      productId: PRODUCT_ID,
      fileIds: [FILE_A, FILE_C],
    });
  });

  it("does not restore a photo the user removed while the replace was in flight", () => {
    const next = applyCommitSuccess([], [FILE_A]);
    expect(next).toEqual([]);
    const afterRemove = applyCommitSuccess(
      committedSlotsFromFileIds([FILE_B]),
      [FILE_A, FILE_B],
    );
    expect(readyOrderedFileIds(afterRemove)).toEqual([FILE_B]);
    expect(
      planPhotoCommit({
        productId: PRODUCT_ID,
        slots: afterRemove,
        lastCommitted: [FILE_A, FILE_B],
        lastWrite: [FILE_A, FILE_B],
        lastFailureKind: null,
        canRetryAttempt: false,
      }),
    ).toEqual({
      kind: "write",
      productId: PRODUCT_ID,
      fileIds: [FILE_B],
    });
  });

  it("keeps a local preview URI when a ready upload becomes committed", () => {
    const slots = [uploadSlot("local-1", "ready", FILE_C)];
    const next = applyCommitSuccess(slots, [FILE_C]);
    expect(next[0]).toMatchObject({
      kind: "committed",
      fileId: FILE_C,
      localUri: "file:///tmp/local-1.jpg",
    });
    expect(toPhotoTiles(next)[0]?.localUri).toBe("file:///tmp/local-1.jpg");
  });

  it("hides cancelled uploads from the tile grid", () => {
    const cancelled = {
      kind: "upload" as const,
      id: "local-1",
      localUri: "file:///tmp/local-1.jpg",
      machine: reduceUpload(initialUploadMachine(), { type: "cancel" }).state,
    };
    expect(toPhotoTiles([cancelled])).toEqual([]);
  });

  it("does not treat duplicate ready ids as two photos", () => {
    const slots = [
      ...committedSlotsFromFileIds([FILE_A]),
      uploadSlot("local-1", "ready", FILE_A),
    ];
    expect(readyOrderedFileIds(slots)).toEqual([FILE_A]);
    expect(fileIdsEqual([FILE_A], [FILE_A])).toBe(true);
  });
});

describe("classifyProductPhotosLoad", () => {
  it("hides the editor without products:edit / files:upload", () => {
    expect(
      classifyProductPhotosLoad({
        canWrite: false,
        productId: PRODUCT_ID,
        clientReady: true,
        status: "success",
        failureKind: null,
      }).kind,
    ).toBe("permission");
  });
});

describe("catalog image strategy and compress plan", () => {
  it("converts HEIC and unknown types to JPEG", () => {
    expect(catalogImageStrategy("image/heic", "x.heic")).toBe("convert-jpeg");
    expect(catalogImageStrategy(undefined, "scan.heif")).toBe("convert-jpeg");
    expect(catalogImageStrategy("image/png", "a.png")).toBe("keep-png");
    expect(catalogImageStrategy("image/jpeg", "a.jpg")).toBe("keep-jpeg");
    expect(catalogImageStrategy("image/webp", "a.webp")).toBe("keep-webp");
    expect(catalogImageStrategy("image/gif", "a.gif")).toBe("convert-jpeg");
  });

  it("stops compressing at the floor instead of looping forever", () => {
    expect(
      nextPhotoCompressPlan({
        byteSize: 2048,
        edge: PHOTO_MAX_EDGE,
        compress: 0.82,
      }),
    ).toEqual({ kind: "ok" });
    expect(
      nextPhotoCompressPlan({
        byteSize: MAX_UPLOAD_BYTES + 1,
        edge: PHOTO_MIN_EDGE,
        compress: PHOTO_MIN_COMPRESS,
      }),
    ).toEqual({ kind: "fail" });
    const again = nextPhotoCompressPlan({
      byteSize: MAX_UPLOAD_BYTES + 1,
      edge: PHOTO_MAX_EDGE,
      compress: 0.82,
    });
    expect(again.kind).toBe("again");
  });
});
