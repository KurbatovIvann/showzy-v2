import { describe, expect, it, vi } from "vitest";

import { flushPhotoSession, runPhotoCommitLoop } from "./product-photos-commit";
import {
  createPhotoSessionStore,
  type PhotoSessionStore,
} from "./product-photos-session";

const FILE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FILE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PRODUCT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

function sessionPorts(
  session: PhotoSessionStore,
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
    getContext: session.getContext,
    send: session.send,
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
    const session = createPhotoSessionStore({
      productId: PRODUCT_ID,
      requireProduct: true,
      snapshotFileIds: [FILE_A, FILE_B],
    });
    const submit = vi.fn();
    const reset = vi.fn();
    await runPhotoCommitLoop(sessionPorts(session, { submit, reset }));
    expect(submit).not.toHaveBeenCalled();
    expect(reset).toHaveBeenCalledOnce();
    expect(session.getContext().commitBusy).toBe(false);
  });

  it("writes file ids then applies the server list", async () => {
    const session = createPhotoSessionStore({
      productId: PRODUCT_ID,
      requireProduct: true,
      snapshotFileIds: [FILE_A, FILE_B],
    });
    session.send({ type: "movePhoto", id: FILE_B, direction: "earlier" });
    const submit = vi.fn((input: { readonly fileIds: readonly string[] }) =>
      Promise.resolve({ fileIds: [...input.fileIds] }),
    );
    const invalidate = vi.fn(() => Promise.resolve());
    await runPhotoCommitLoop(sessionPorts(session, { submit, invalidate }));
    expect(submit).toHaveBeenCalledWith({
      productId: PRODUCT_ID,
      fileIds: [FILE_B, FILE_A],
    });
    expect(invalidate).toHaveBeenCalledOnce();
    expect(session.getContext().baseline).toEqual([FILE_B, FILE_A]);
    expect(session.getContext().commitBusy).toBe(false);
  });

  it("retries the in-flight attempt instead of minting a new write", async () => {
    const session = createPhotoSessionStore({
      productId: PRODUCT_ID,
      requireProduct: true,
      snapshotFileIds: [FILE_A, FILE_B],
    });
    session.send({ type: "movePhoto", id: FILE_B, direction: "earlier" });
    session.send({ type: "noteWrite", fileIds: [FILE_B, FILE_A] });
    session.send({ type: "commitFailed", kind: "network" });
    session.send({ type: "setCanRetryAttempt", value: true });
    const submit = vi.fn();
    const retry = vi.fn(() => Promise.resolve({ fileIds: [FILE_B, FILE_A] }));
    await runPhotoCommitLoop(sessionPorts(session, { submit, retry }));
    expect(submit).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledOnce();
    expect(session.getContext().lastFailureKind).toBeNull();
  });

  it("queues when a commit is already running", async () => {
    const session = createPhotoSessionStore({
      productId: PRODUCT_ID,
      requireProduct: true,
      snapshotFileIds: [FILE_A],
    });
    session.send({ type: "beginCommit" });
    const submit = vi.fn();
    await runPhotoCommitLoop(sessionPorts(session, { submit }));
    expect(submit).not.toHaveBeenCalled();
    expect(session.getContext().commitQueued).toBe(true);
    expect(session.getContext().commitBusy).toBe(true);
  });

  it("records commitFailed and still finishes the busy flag", async () => {
    const session = createPhotoSessionStore({
      productId: PRODUCT_ID,
      requireProduct: true,
      snapshotFileIds: [FILE_A, FILE_B],
    });
    session.send({ type: "movePhoto", id: FILE_B, direction: "earlier" });
    await runPhotoCommitLoop(
      sessionPorts(session, {
        submit: () => Promise.reject(new TypeError("Failed to fetch")),
      }),
    );
    expect(session.getContext().lastFailureKind).toBe("network");
    expect(session.getContext().commitBusy).toBe(false);
  });

  it("loops once more when a write is queued mid-submit", async () => {
    const session = createPhotoSessionStore({
      productId: PRODUCT_ID,
      requireProduct: true,
      snapshotFileIds: [FILE_A, FILE_B],
    });
    session.send({ type: "movePhoto", id: FILE_B, direction: "earlier" });
    const submit = vi.fn((input: { readonly fileIds: readonly string[] }) => {
      session.send({ type: "queueCommit" });
      return Promise.resolve({ fileIds: [...input.fileIds] });
    });
    await runPhotoCommitLoop(sessionPorts(session, { submit }));
    expect(submit).toHaveBeenCalledOnce();
    expect(session.getContext().commitQueued).toBe(false);
  });
});

describe("flushPhotoSession", () => {
  it("returns commit-failed after a failed replace and ok after a matching write", async () => {
    const session = createPhotoSessionStore({
      productId: PRODUCT_ID,
      requireProduct: true,
      snapshotFileIds: [FILE_A],
    });
    session.send({ type: "removePhoto", id: FILE_A });
    session.send({ type: "commitFailed", kind: "network" });
    const failed = await flushPhotoSession({
      kickIdle: () => undefined,
      waitUntilSettled: () => Promise.resolve(),
      commitIfNeeded: () => Promise.resolve(),
      getContext: session.getContext,
      send: session.send,
    });
    expect(failed).toBe("commit-failed");
    session.send({ type: "commitSucceeded", fileIds: [] });
    const ok = await flushPhotoSession({
      kickIdle: () => undefined,
      waitUntilSettled: () => Promise.resolve(),
      commitIfNeeded: () => Promise.resolve(),
      getContext: session.getContext,
      send: session.send,
    });
    expect(ok).toBe("ok");
    expect(session.getContext().lastFailureKind).toBeNull();
  });
});
