import { describe, expect, it, vi } from "vitest";

import { flushPhotoSession, runPhotoCommitLoop } from "./product-photos-commit";
import { startPhotoSession } from "./product-photos-session";

const FILE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FILE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PRODUCT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

function actorPorts(
  actor: ReturnType<typeof startPhotoSession>,
  extra: {
    submit?: (input: {
      readonly productId: string;
      readonly fileIds: readonly string[];
    }) => Promise<{ readonly fileIds: readonly string[] }>;
    retry?: () => Promise<{ readonly fileIds: readonly string[] }>;
    reset?: () => void;
    invalidate?: () => Promise<void>;
    onSettled?: () => void;
  } = {},
) {
  return {
    getContext: () => actor.getSnapshot().context,
    send: actor.send,
    submit:
      extra.submit ??
      ((input: {
        readonly productId: string;
        readonly fileIds: readonly string[];
      }) => Promise.resolve({ fileIds: [...input.fileIds] })),
    retry: extra.retry ?? (() => Promise.resolve({ fileIds: [FILE_A] })),
    reset: extra.reset ?? (() => undefined),
    invalidate: extra.invalidate ?? (() => Promise.resolve()),
    onSettled: extra.onSettled ?? (() => undefined),
  };
}

describe("runPhotoCommitLoop", () => {
  it("noops without submit when the ordered list already matches", async () => {
    const actor = startPhotoSession({
      productId: PRODUCT_ID,
      requireProduct: true,
      snapshotFileIds: [FILE_A, FILE_B],
    });
    const submit = vi.fn();
    const reset = vi.fn();
    await runPhotoCommitLoop(actorPorts(actor, { submit, reset }));
    expect(submit).not.toHaveBeenCalled();
    expect(reset).toHaveBeenCalledOnce();
    expect(actor.getSnapshot().context.commitBusy).toBe(false);
    actor.stop();
  });

  it("writes file ids then applies the server list", async () => {
    const actor = startPhotoSession({
      productId: PRODUCT_ID,
      requireProduct: true,
      snapshotFileIds: [FILE_A, FILE_B],
    });
    actor.send({ type: "movePhoto", id: FILE_B, direction: "earlier" });
    const submit = vi.fn((input: { readonly fileIds: readonly string[] }) =>
      Promise.resolve({ fileIds: [...input.fileIds] }),
    );
    const invalidate = vi.fn(() => Promise.resolve());
    await runPhotoCommitLoop(actorPorts(actor, { submit, invalidate }));
    expect(submit).toHaveBeenCalledWith({
      productId: PRODUCT_ID,
      fileIds: [FILE_B, FILE_A],
    });
    expect(invalidate).toHaveBeenCalledOnce();
    expect(actor.getSnapshot().context.baseline).toEqual([FILE_B, FILE_A]);
    expect(actor.getSnapshot().context.commitBusy).toBe(false);
    actor.stop();
  });

  it("retries the in-flight attempt instead of minting a new write", async () => {
    const actor = startPhotoSession({
      productId: PRODUCT_ID,
      requireProduct: true,
      snapshotFileIds: [FILE_A, FILE_B],
    });
    actor.send({ type: "movePhoto", id: FILE_B, direction: "earlier" });
    actor.send({ type: "noteWrite", fileIds: [FILE_B, FILE_A] });
    actor.send({ type: "commitFailed", kind: "network" });
    actor.send({ type: "setCanRetryAttempt", value: true });
    const submit = vi.fn();
    const retry = vi.fn(() => Promise.resolve({ fileIds: [FILE_B, FILE_A] }));
    await runPhotoCommitLoop(actorPorts(actor, { submit, retry }));
    expect(submit).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledOnce();
    expect(actor.getSnapshot().context.lastFailureKind).toBeNull();
    actor.stop();
  });

  it("queues when a commit is already running", async () => {
    const actor = startPhotoSession({
      productId: PRODUCT_ID,
      requireProduct: true,
      snapshotFileIds: [FILE_A],
    });
    actor.send({ type: "beginCommit" });
    const submit = vi.fn();
    await runPhotoCommitLoop(actorPorts(actor, { submit }));
    expect(submit).not.toHaveBeenCalled();
    expect(actor.getSnapshot().context.commitQueued).toBe(true);
    expect(actor.getSnapshot().context.commitBusy).toBe(true);
    actor.stop();
  });

  it("records commitFailed and still finishes the busy flag", async () => {
    const actor = startPhotoSession({
      productId: PRODUCT_ID,
      requireProduct: true,
      snapshotFileIds: [FILE_A, FILE_B],
    });
    actor.send({ type: "movePhoto", id: FILE_B, direction: "earlier" });
    await runPhotoCommitLoop(
      actorPorts(actor, {
        submit: () => Promise.reject(new TypeError("Failed to fetch")),
      }),
    );
    expect(actor.getSnapshot().context.lastFailureKind).toBe("network");
    expect(actor.getSnapshot().context.commitBusy).toBe(false);
    actor.stop();
  });

  it("loops once more when a write is queued mid-submit", async () => {
    const actor = startPhotoSession({
      productId: PRODUCT_ID,
      requireProduct: true,
      snapshotFileIds: [FILE_A, FILE_B],
    });
    actor.send({ type: "movePhoto", id: FILE_B, direction: "earlier" });
    const submit = vi.fn((input: { readonly fileIds: readonly string[] }) => {
      actor.send({ type: "queueCommit" });
      return Promise.resolve({ fileIds: [...input.fileIds] });
    });
    await runPhotoCommitLoop(actorPorts(actor, { submit }));
    expect(submit).toHaveBeenCalledOnce();
    expect(actor.getSnapshot().context.commitQueued).toBe(false);
    actor.stop();
  });
});

describe("flushPhotoSession", () => {
  it("returns commit-failed after a failed replace and ok after a matching write", async () => {
    const actor = startPhotoSession({
      productId: PRODUCT_ID,
      requireProduct: true,
      snapshotFileIds: [FILE_A],
    });
    actor.send({ type: "removePhoto", id: FILE_A });
    actor.send({ type: "commitFailed", kind: "network" });
    const failed = await flushPhotoSession({
      kickIdle: () => undefined,
      waitUntilSettled: () => Promise.resolve(),
      commitIfNeeded: () => Promise.resolve(),
      getContext: () => actor.getSnapshot().context,
      send: actor.send,
    });
    expect(failed).toBe("commit-failed");
    actor.send({ type: "commitSucceeded", fileIds: [] });
    const ok = await flushPhotoSession({
      kickIdle: () => undefined,
      waitUntilSettled: () => Promise.resolve(),
      commitIfNeeded: () => Promise.resolve(),
      getContext: () => actor.getSnapshot().context,
      send: actor.send,
    });
    expect(ok).toBe("ok");
    expect(actor.getSnapshot().context.lastFailureKind).toBeNull();
    actor.stop();
  });
});
