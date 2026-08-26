import { SET_PRODUCT_IMAGES_MAX } from "@showzy/validation/catalog";
import { describe, expect, it } from "vitest";

import {
  SET_PRODUCT_IMAGES_MAX as photosCap,
  remainingPhotoSlots,
} from "./product-photos-model";
import {
  createPhotoSessionStore,
  photoSessionDirty,
  photoSessionNeedsCommit,
  photoSessionTiles,
  selectPhotoSessionCommitPlan,
  selectPhotoSessionFlushOutcome,
  selectPhotoSessionIdleIds,
  snapshotFileIdsFromArgs,
  type PhotoSessionContext,
  type PhotoSessionInput,
} from "./product-photos-session";
import {
  initialUploadMachine,
  reduceUpload,
  type UploadMachine,
} from "./product-photos-upload";

const FILE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FILE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
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

function puttingMachine(): UploadMachine {
  let machine = initialUploadMachine();
  machine = reduceUpload(machine, { type: "start" }).state;
  machine = reduceUpload(machine, { type: "prepared" }).state;
  machine = reduceUpload(machine, {
    type: "requested",
    fileId: FILE_C,
  }).state;
  machine = reduceUpload(machine, { type: "signed" }).state;
  return machine;
}

function editInput(
  snapshotFileIds: readonly string[] | null,
): PhotoSessionInput {
  return {
    productId: PRODUCT_ID,
    requireProduct: true,
    snapshotFileIds: snapshotFileIds === null ? null : [...snapshotFileIds],
  };
}

describe("product photo session", () => {
  it("treats omitted imageFileIds as loading on edit and empty on create", () => {
    expect(snapshotFileIdsFromArgs({ requireProduct: true })).toBeNull();
    expect(snapshotFileIdsFromArgs({ requireProduct: false })).toEqual([]);
    expect(
      snapshotFileIdsFromArgs({
        requireProduct: true,
        imageFileIds: [FILE_A],
      }),
    ).toEqual([FILE_A]);
  });

  it("hydrates from imageFileIds without a product query", () => {
    const actor = createPhotoSessionStore(editInput([FILE_A, FILE_B]));
    const context = actor.getContext();
    expect(context.baseline).toEqual([FILE_A, FILE_B]);
    expect(photoSessionTiles(context).map((tile) => tile.fileId)).toEqual([
      FILE_A,
      FILE_B,
    ]);
    expect(photoSessionTiles(context)[0]?.isCover).toBe(true);
    expect(selectPhotoSessionCommitPlan(context)).toEqual({ kind: "noop" });
  });

  it("hydrates later when the parent snapshot arrives", () => {
    const actor = createPhotoSessionStore(editInput(null));
    expect(actor.getContext().baseline).toBeNull();
    expect(actor.getContext().hydratedKey).toBeNull();
    actor.send({
      type: "hydrate",
      productId: PRODUCT_ID,
      imageFileIds: [FILE_B],
    });
    expect(actor.getContext().baseline).toEqual([FILE_B]);
    actor.send({
      type: "hydrate",
      productId: PRODUCT_ID,
      imageFileIds: [FILE_A],
    });
    expect(actor.getContext().baseline).toEqual([FILE_B]);
  });

  it("adds, removes, and reorders slots up to the validation cap", () => {
    expect(photosCap).toBe(SET_PRODUCT_IMAGES_MAX);
    const actor = createPhotoSessionStore(editInput([FILE_A]));
    actor.send({
      type: "addPhotos",
      photos: [{ id: "local-1", localUri: "file:///tmp/n.jpg" }],
    });
    expect(selectPhotoSessionIdleIds(actor.getContext())).toEqual(["local-1"]);
    actor.send({ type: "movePhoto", id: "local-1", direction: "earlier" });
    expect(
      actor
        .getContext()
        .slots.map((slot: PhotoSessionContext["slots"][number]) => slot.id),
    ).toEqual(["local-1", FILE_A]);
    actor.send({ type: "removePhoto", id: FILE_A });
    expect(
      actor
        .getContext()
        .slots.map((slot: PhotoSessionContext["slots"][number]) => slot.id),
    ).toEqual(["local-1"]);
    const filled = createPhotoSessionStore(
      editInput(
        Array.from({ length: SET_PRODUCT_IMAGES_MAX }, (_, index) => {
          const n = index.toString(16).padStart(12, "0");
          return `aaaaaaaa-aaaa-4aaa-8aaa-${n}`;
        }),
      ),
    );
    expect(remainingPhotoSlots(filled.getContext().slots)).toBe(0);
    filled.send({ type: "openPicker" });
    expect(filled.getContext().localBanner).toBe("too_many");
    filled.send({
      type: "addPhotos",
      photos: [{ id: "local-x", localUri: "file:///tmp/x.jpg" }],
    });
    expect(filled.getContext().slots).toHaveLength(SET_PRODUCT_IMAGES_MAX);
  });

  it("plans commit noop vs write vs retry from session context", () => {
    const actor = createPhotoSessionStore(editInput([FILE_A, FILE_B]));
    expect(selectPhotoSessionCommitPlan(actor.getContext())).toEqual({
      kind: "noop",
    });
    actor.send({ type: "movePhoto", id: FILE_B, direction: "earlier" });
    expect(selectPhotoSessionCommitPlan(actor.getContext())).toEqual({
      kind: "write",
      productId: PRODUCT_ID,
      fileIds: [FILE_B, FILE_A],
    });
    actor.send({ type: "noteWrite", fileIds: [FILE_B, FILE_A] });
    actor.send({ type: "commitFailed", kind: "network" });
    actor.send({ type: "setCanRetryAttempt", value: true });
    expect(selectPhotoSessionCommitPlan(actor.getContext())).toEqual({
      kind: "retry",
    });
  });

  it("flush is ok after a matching write and commit-failed after a failed replace", () => {
    const actor = createPhotoSessionStore({
      productId: null,
      requireProduct: false,
      snapshotFileIds: [],
    });
    actor.send({
      type: "addPhotos",
      photos: [{ id: "local-1", localUri: "file:///tmp/n.jpg" }],
    });
    actor.send({
      type: "patchMachine",
      id: "local-1",
      machine: readyMachine(FILE_C),
    });
    expect(photoSessionDirty(actor.getContext())).toBe(true);
    expect(selectPhotoSessionCommitPlan(actor.getContext())).toEqual({
      kind: "noop",
    });
    actor.send({ type: "bindProductId", productId: PRODUCT_ID });
    expect(selectPhotoSessionCommitPlan(actor.getContext())).toEqual({
      kind: "write",
      productId: PRODUCT_ID,
      fileIds: [FILE_C],
    });
    actor.send({ type: "commitFailed", kind: "network" });
    expect(selectPhotoSessionFlushOutcome(actor.getContext())).toBe(
      "commit-failed",
    );
    actor.send({ type: "commitSucceeded", fileIds: [FILE_C] });
    expect(selectPhotoSessionFlushOutcome(actor.getContext())).toBe("ok");
    expect(photoSessionNeedsCommit(actor.getContext())).toBe(false);
    expect(photoSessionDirty(actor.getContext())).toBe(false);
  });

  it("cancel drops an in-flight upload so the commit plan does not keep it", () => {
    const actor = createPhotoSessionStore(editInput([FILE_A]));
    actor.send({
      type: "addPhotos",
      photos: [{ id: "local-1", localUri: "file:///tmp/n.jpg" }],
    });
    actor.send({
      type: "patchMachine",
      id: "local-1",
      machine: puttingMachine(),
    });
    expect(selectPhotoSessionIdleIds(actor.getContext())).toEqual([]);
    actor.send({ type: "cancelUpload", id: "local-1" });
    expect(
      actor
        .getContext()
        .slots.map((slot: PhotoSessionContext["slots"][number]) => slot.id),
    ).toEqual([FILE_A]);
    expect(selectPhotoSessionCommitPlan(actor.getContext())).toEqual({
      kind: "noop",
    });
  });
});
