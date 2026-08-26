import { describe, expect, it, vi } from "vitest";

import { createProductPhotosRuntime } from "./product-photos-runtime";
import { createPhotoSessionStore } from "./product-photos-session";
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

function cancelledMachine(): UploadMachine {
  return reduceUpload(initialUploadMachine(), { type: "cancel" }).state;
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
    const session = createPhotoSessionStore({
      productId: PRODUCT_ID,
      requireProduct: true,
      snapshotFileIds: [FILE_A],
    });
    session.send({
      type: "addPhotos",
      photos: [{ id: "local-1", localUri: "file:///tmp/n.jpg" }],
    });
    const commitIfNeeded = vi.fn(() => Promise.resolve());
    const runtime = createProductPhotosRuntime({
      getContext: session.getContext,
      send: session.send,
      getClient: () => null,
      commitIfNeeded,
      ...unusedIo(),
    });
    runtime.cancelUpload("local-1");
    expect(session.getContext().slots.map((slot) => slot.id)).toEqual([FILE_A]);
    expect(commitIfNeeded).toHaveBeenCalledOnce();
  });

  it("cancel aborts the handshake at runtime, not only the session slot", async () => {
    const session = createPhotoSessionStore({
      productId: PRODUCT_ID,
      requireProduct: true,
      snapshotFileIds: [FILE_A],
    });
    session.send({
      type: "addPhotos",
      photos: [{ id: "local-1", localUri: "file:///tmp/n.jpg" }],
    });
    const handshake: { signal: AbortSignal | null } = { signal: null };
    const runUpload = vi.fn(
      (args: { readonly signal: AbortSignal }) =>
        new Promise<{
          readonly machine: UploadMachine;
          readonly prepared: null;
          readonly requestAttempt: null;
          readonly finalizeAttempt: null;
        }>((resolve) => {
          handshake.signal = args.signal;
          args.signal.addEventListener("abort", () => {
            resolve({
              machine: cancelledMachine(),
              prepared: null,
              requestAttempt: null,
              finalizeAttempt: null,
            });
          });
        }),
    );
    const commitIfNeeded = vi.fn(() => Promise.resolve());
    const runtime = createProductPhotosRuntime({
      getContext: session.getContext,
      send: session.send,
      getClient: () => null,
      commitIfNeeded,
      pickPhotos: unusedIo().pickPhotos,
      prepareImage: unusedIo().prepareImage,
      putBytes: unusedIo().putBytes,
      runUpload,
    });
    const running = runtime.runSlot("local-1", "start");
    await vi.waitFor(() => {
      expect(runUpload).toHaveBeenCalledOnce();
    });
    expect(handshake.signal?.aborted).toBe(false);
    runtime.cancelUpload("local-1");
    expect(handshake.signal?.aborted).toBe(true);
    await running;
    expect(session.getContext().slots.map((slot) => slot.id)).toEqual([FILE_A]);
    expect(commitIfNeeded).toHaveBeenCalledOnce();
  });

  it("maps picker denied and canceled without adding slots", async () => {
    const session = createPhotoSessionStore({
      productId: PRODUCT_ID,
      requireProduct: true,
      snapshotFileIds: [FILE_A],
    });
    const pickPhotos = vi
      .fn()
      .mockResolvedValueOnce({ kind: "denied", source: "camera" })
      .mockResolvedValueOnce({ kind: "canceled" });
    const runtime = createProductPhotosRuntime({
      getContext: session.getContext,
      send: session.send,
      getClient: () => null,
      commitIfNeeded: () => Promise.resolve(),
      pickPhotos,
      prepareImage: unusedIo().prepareImage,
      putBytes: unusedIo().putBytes,
      waitUntilSheetHidden: () => Promise.resolve(),
    });
    await runtime.pickFrom("camera");
    expect(session.getContext().localBanner).toBe("denied");
    expect(session.getContext().slots).toHaveLength(1);
    await runtime.pickFrom("library");
    expect(session.getContext().slots).toHaveLength(1);
  });

  it("adds picked photos and starts idle uploads", async () => {
    const session = createPhotoSessionStore({
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
      getContext: session.getContext,
      send: session.send,
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
    expect(session.getContext().slots).toHaveLength(2);
    expect(runUpload).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(commitIfNeeded).toHaveBeenCalled();
    });
  });
});
