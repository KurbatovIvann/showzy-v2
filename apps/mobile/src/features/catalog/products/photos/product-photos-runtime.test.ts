import { describe, expect, it, vi } from "vitest";

import { createProductPhotosRuntime } from "./product-photos-runtime";
import { startPhotoSession } from "./product-photos-session";
import {
  initialUploadMachine,
  reduceUpload,
  type UploadMachine,
} from "./product-photos-upload";

const FILE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FILE_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PRODUCT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

function readyMachine(fileId: string): UploadMachine {
  let machine = initialUploadMachine();
  machine = reduceUpload(machine, { type: "start" }).state;
  machine = reduceUpload(machine, { type: "prepared" }).state;
  machine = reduceUpload(machine, { type: "requested", fileId }).state;
  machine = reduceUpload(machine, { type: "signed" }).state;
  machine = reduceUpload(machine, { type: "put" }).state;
  return reduceUpload(machine, { type: "finalized" }).state;
}

function unusedIo() {
  return {
    pickPhotos: () => Promise.resolve({ kind: "canceled" as const }),
    prepareImage: () => Promise.reject(new Error("prepare should not run")),
    putBytes: () => Promise.resolve(),
    runUpload: () =>
      Promise.reject(new Error("upload should not start after cancel")),
  };
}

describe("createProductPhotosRuntime", () => {
  it("drops an in-flight upload and re-plans commit", () => {
    const actor = startPhotoSession({
      productId: PRODUCT_ID,
      requireProduct: true,
      snapshotFileIds: [FILE_A],
    });
    actor.send({
      type: "addPhotos",
      photos: [{ id: "local-1", localUri: "file:///tmp/n.jpg" }],
    });
    const commitIfNeeded = vi.fn(() => Promise.resolve());
    const runtime = createProductPhotosRuntime({
      getContext: () => actor.getSnapshot().context,
      send: actor.send,
      getClient: () => null,
      commitIfNeeded,
      ...unusedIo(),
    });
    runtime.cancelUpload("local-1");
    expect(actor.getSnapshot().context.slots.map((slot) => slot.id)).toEqual([
      FILE_A,
    ]);
    expect(commitIfNeeded).toHaveBeenCalledOnce();
    actor.stop();
  });

  it("maps picker denied and canceled without adding slots", async () => {
    const actor = startPhotoSession({
      productId: PRODUCT_ID,
      requireProduct: true,
      snapshotFileIds: [FILE_A],
    });
    const pickPhotos = vi
      .fn()
      .mockResolvedValueOnce({ kind: "denied", source: "camera" })
      .mockResolvedValueOnce({ kind: "canceled" });
    const runtime = createProductPhotosRuntime({
      getContext: () => actor.getSnapshot().context,
      send: actor.send,
      getClient: () => null,
      commitIfNeeded: () => Promise.resolve(),
      pickPhotos,
      prepareImage: unusedIo().prepareImage,
      putBytes: unusedIo().putBytes,
      waitUntilSheetHidden: () => Promise.resolve(),
    });
    await runtime.pickFrom("camera");
    expect(actor.getSnapshot().context.localBanner).toBe("denied");
    expect(actor.getSnapshot().context.slots).toHaveLength(1);
    await runtime.pickFrom("library");
    expect(actor.getSnapshot().context.slots).toHaveLength(1);
    actor.stop();
  });

  it("adds picked photos and starts idle uploads", async () => {
    const actor = startPhotoSession({
      productId: PRODUCT_ID,
      requireProduct: true,
      snapshotFileIds: [FILE_A],
    });
    const runUpload = vi.fn(() =>
      Promise.resolve({
        machine: readyMachine(FILE_C),
        prepared: null,
        requestAttempt: null,
        finalizeAttempt: null,
      }),
    );
    const commitIfNeeded = vi.fn(() => Promise.resolve());
    const runtime = createProductPhotosRuntime({
      getContext: () => actor.getSnapshot().context,
      send: actor.send,
      getClient: () => null,
      commitIfNeeded,
      pickPhotos: () =>
        Promise.resolve({
          kind: "picked",
          photos: [
            {
              uri: "file:///tmp/n.jpg",
              mimeType: "image/jpeg",
              fileName: "n.jpg",
            },
          ],
        }),
      prepareImage: unusedIo().prepareImage,
      putBytes: unusedIo().putBytes,
      waitUntilSheetHidden: () => Promise.resolve(),
      runUpload,
    });
    await runtime.pickFrom("library");
    expect(actor.getSnapshot().context.slots).toHaveLength(2);
    expect(runUpload).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(commitIfNeeded).toHaveBeenCalled();
    });
    actor.stop();
  });
});
