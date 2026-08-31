import { describe, expect, it } from "vitest";

import { productEditorHref, productPhotoHref } from "../shared/product-hrefs";
import {
  addUploadSlots,
  applyCommitSuccess,
  canAddPhoto,
  catalogImagePreparePlan,
  catalogImageStrategy,
  committedSlotsFromFileIds,
  classifyProductPhotosLoad,
  fileIdsEqual,
  hasInFlightPhotoUploads,
  mapDeniedBanner,
  mapPhotoFailure,
  movePhotoSlot,
  nextPhotoCompressPlan,
  photoFlushOutcome,
  photosAreDirty,
  planPhotoCommit,
  productPhotosStripDownloadInput,
  readyOrderedFileIds,
  remainingPhotoSlots,
  removePhotoSlot,
  resolveProductPhotosBannerKey,
  toPhotoTiles,
  PRODUCT_PHOTOS_STRIP_RENDITION,
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
    expect(
      photoFlushOutcome({
        planKind: "write",
        lastFailureKind: "network",
        slots,
      }),
    ).toBe("commit-failed");
    expect(
      photoFlushOutcome({
        planKind: "retry",
        lastFailureKind: null,
        slots,
      }),
    ).toBe("ok");
  });

  it("flush is ok after noop-after-undo when the user removed the failed pick so ready ids match the server", () => {
    const slots = committedSlotsFromFileIds([FILE_A]);
    expect(
      planPhotoCommit({
        productId: PRODUCT_ID,
        slots,
        lastCommitted: [FILE_A],
        lastWrite: [FILE_A, FILE_B],
        lastFailureKind: "network",
        canRetryAttempt: false,
      }),
    ).toEqual({ kind: "noop" });
    expect(
      photoFlushOutcome({
        planKind: "noop",
        lastFailureKind: "network",
        slots,
      }),
    ).toBe("ok");
  });

  it("flush is not ok when a committed photo remains and a failed upload is still in the slots", () => {
    const slots = [
      ...committedSlotsFromFileIds([FILE_A]),
      uploadSlot("local-1", "failed"),
    ];
    expect(readyOrderedFileIds(slots)).toEqual([FILE_A]);
    expect(
      planPhotoCommit({
        productId: PRODUCT_ID,
        slots,
        lastCommitted: [FILE_A],
        lastWrite: null,
        lastFailureKind: null,
        canRetryAttempt: false,
      }),
    ).toEqual({ kind: "noop" });
    expect(photosAreDirty(slots, [FILE_A])).toBe(true);
    expect(
      photoFlushOutcome({
        planKind: "noop",
        lastFailureKind: null,
        slots,
      }),
    ).toBe("upload-failed");
    const emptyReady = [uploadSlot("local-2", "failed")];
    expect(readyOrderedFileIds(emptyReady)).toEqual([]);
    expect(
      planPhotoCommit({
        productId: PRODUCT_ID,
        slots: emptyReady,
        lastCommitted: [],
        lastWrite: null,
        lastFailureKind: null,
        canRetryAttempt: false,
      }),
    ).toEqual({ kind: "noop" });
    expect(
      photoFlushOutcome({
        planKind: "noop",
        lastFailureKind: null,
        slots: emptyReady,
      }),
    ).toBe("upload-failed");
    const idleSlots = [
      ...committedSlotsFromFileIds([FILE_A]),
      uploadSlot("local-idle"),
    ];
    expect(readyOrderedFileIds(idleSlots)).toEqual([FILE_A]);
    expect(
      planPhotoCommit({
        productId: PRODUCT_ID,
        slots: idleSlots,
        lastCommitted: [FILE_A],
        lastWrite: null,
        lastFailureKind: null,
        canRetryAttempt: false,
      }),
    ).toEqual({ kind: "noop" });
    expect(
      photoFlushOutcome({
        planKind: "noop",
        lastFailureKind: null,
        slots: idleSlots,
      }),
    ).toBe("upload-failed");
  });

  it("lets create and edit attach, and defers setProductImages until a product id exists", () => {
    expect(
      classifyProductPhotosLoad({
        canWrite: true,
        productId: null,
        requireProduct: false,
        clientReady: true,
        status: "pending",
        failureKind: null,
      }).kind,
    ).toBe("ready");
    expect(
      classifyProductPhotosLoad({
        canWrite: true,
        productId: PRODUCT_ID,
        requireProduct: true,
        clientReady: true,
        status: "success",
        failureKind: null,
      }).kind,
    ).toBe("ready");
    expect(canAddPhoto([])).toBe(true);
    expect(
      classifyProductPhotosLoad({
        canWrite: true,
        productId: PRODUCT_ID,
        requireProduct: true,
        clientReady: true,
        status: "pending",
        failureKind: null,
      }).kind,
    ).toBe("loading");
    const ready = [uploadSlot("local-1", "ready", FILE_C)];
    expect(
      planPhotoCommit({
        productId: null,
        slots: ready,
        lastCommitted: [],
        lastWrite: null,
        lastFailureKind: null,
        canRetryAttempt: false,
      }),
    ).toEqual({ kind: "noop" });
    expect(
      planPhotoCommit({
        productId: PRODUCT_ID,
        slots: ready,
        lastCommitted: [],
        lastWrite: null,
        lastFailureKind: null,
        canRetryAttempt: false,
      }),
    ).toEqual({
      kind: "write",
      productId: PRODUCT_ID,
      fileIds: [FILE_C],
    });
  });

  it("does not keep a /photos route — attach is create, edit, and detail", () => {
    expect(productPhotoHref(PRODUCT_ID)).toBe(`/products/${PRODUCT_ID}`);
    expect(productPhotoHref(PRODUCT_ID)).not.toBe(
      productEditorHref(PRODUCT_ID),
    );
    expect(productPhotoHref(PRODUCT_ID)).not.toContain("/photos");
  });

  it("treats local picks as dirty until they are committed", () => {
    expect(photosAreDirty([], [])).toBe(false);
    expect(photosAreDirty([uploadSlot("local-1")], [])).toBe(true);
    expect(hasInFlightPhotoUploads([uploadSlot("local-1")])).toBe(true);
    expect(
      hasInFlightPhotoUploads([uploadSlot("local-1", "ready", FILE_C)]),
    ).toBe(false);
    expect(photosAreDirty(committedSlotsFromFileIds([FILE_A]), [FILE_A])).toBe(
      false,
    );
    expect(
      photosAreDirty(committedSlotsFromFileIds([FILE_B, FILE_A]), [
        FILE_A,
        FILE_B,
      ]),
    ).toBe(true);
    expect(mapDeniedBanner("camera")).toBe("denied");
    expect(mapDeniedBanner(null)).toBeNull();
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

describe("productPhotosStripDownloadInput", () => {
  it("requests the card rendition for strip and picker previews (SHO-244)", () => {
    expect(PRODUCT_PHOTOS_STRIP_RENDITION).toBe("card");
    expect(productPhotosStripDownloadInput([FILE_A, FILE_B])).toEqual({
      fileIds: [FILE_A, FILE_B],
      rendition: "card",
    });
  });
});

describe("resolveProductPhotosBannerKey", () => {
  it("maps a getDownloadUrls failure to a banner, not success with an empty URL", () => {
    expect(
      resolveProductPhotosBannerKey({
        localBanner: null,
        mutationFailure: null,
        downloadFailure: "network",
      }),
    ).toBe("network");
    expect(
      resolveProductPhotosBannerKey({
        localBanner: null,
        mutationFailure: null,
        downloadFailure: "not_found",
      }),
    ).toBe("unavailable");
    expect(
      resolveProductPhotosBannerKey({
        localBanner: null,
        mutationFailure: null,
        downloadFailure: null,
      }),
    ).toBeNull();
    expect(mapPhotoFailure("network")).toBe("network");
    expect(
      resolveProductPhotosBannerKey({
        localBanner: "too_many",
        mutationFailure: "network",
        downloadFailure: "offline",
      }),
    ).toBe("too_many");
    expect(
      resolveProductPhotosBannerKey({
        localBanner: null,
        mutationFailure: "network",
        downloadFailure: "offline",
      }),
    ).toBe("network");
  });
});

describe("classifyProductPhotosLoad", () => {
  it("hides the editor without products:edit / files:upload", () => {
    expect(
      classifyProductPhotosLoad({
        canWrite: false,
        productId: PRODUCT_ID,
        requireProduct: true,
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

  it("does not keep an in-cap JPEG as-is when the long edge exceeds PHOTO_MAX_EDGE", () => {
    const cameraJpegBytes = 5 * 1024 * 1024;
    expect(cameraJpegBytes).toBeLessThan(MAX_UPLOAD_BYTES);
    expect(
      catalogImagePreparePlan({
        strategy: "keep-jpeg",
        byteSize: cameraJpegBytes,
        longEdge: 4032,
      }),
    ).toEqual({ kind: "compress" });
    expect(
      catalogImagePreparePlan({
        strategy: "keep-png",
        byteSize: cameraJpegBytes,
        longEdge: PHOTO_MAX_EDGE + 1,
      }),
    ).toEqual({ kind: "compress" });
    expect(
      catalogImagePreparePlan({
        strategy: "keep-webp",
        byteSize: 800_000,
        longEdge: 3000,
      }),
    ).toEqual({ kind: "compress" });
  });

  it("keeps an in-cap JPEG/PNG/WebP that is already ≤ PHOTO_MAX_EDGE", () => {
    expect(
      catalogImagePreparePlan({
        strategy: "keep-jpeg",
        byteSize: 200_000,
        longEdge: PHOTO_MAX_EDGE,
      }),
    ).toEqual({ kind: "keep" });
    expect(
      catalogImagePreparePlan({
        strategy: "keep-jpeg",
        byteSize: 80_000,
        longEdge: 1600,
      }),
    ).toEqual({ kind: "keep" });
    expect(
      catalogImagePreparePlan({
        strategy: "keep-png",
        byteSize: 120_000,
        longEdge: 1024,
      }),
    ).toEqual({ kind: "keep" });
    expect(
      catalogImagePreparePlan({
        strategy: "keep-webp",
        byteSize: 90_000,
        longEdge: 800,
      }),
    ).toEqual({ kind: "keep" });
  });

  it("still converts HEIC and oversize files even when the long edge is small", () => {
    expect(
      catalogImagePreparePlan({
        strategy: "convert-jpeg",
        byteSize: 200_000,
        longEdge: 1600,
      }),
    ).toEqual({ kind: "compress" });
    expect(
      catalogImagePreparePlan({
        strategy: "keep-jpeg",
        byteSize: MAX_UPLOAD_BYTES + 1,
        longEdge: 1600,
      }),
    ).toEqual({ kind: "compress" });
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
