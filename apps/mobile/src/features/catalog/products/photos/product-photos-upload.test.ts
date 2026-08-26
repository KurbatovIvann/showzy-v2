import { describe, expect, it } from "vitest";

import { createMutationAttempt } from "@showzy/contract";

import {
  initialUploadMachine,
  reduceUpload,
  runProductPhotoUpload,
  type PreparedCatalogImage,
  type ProductPhotoUploadPorts,
  type UploadEvent,
  type UploadMachine,
} from "./product-photos-upload";

const FILE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PUT_URL = "https://objects.example.invalid/uploads/pending";
const CHECKSUM = "a".repeat(64);

function prepared(): PreparedCatalogImage {
  return {
    uri: "file:///tmp/photo.jpg",
    mimeType: "image/jpeg",
    byteSize: 1024,
    checksumSha256: CHECKSUM,
  };
}

function drive(
  events: readonly UploadEvent[],
  start: UploadMachine = initialUploadMachine(),
): UploadMachine {
  let state = start;
  for (const event of events) {
    state = reduceUpload(state, event).state;
  }
  return state;
}

function fakePorts(args: {
  readonly failAt?: "prepare" | "request" | "sign" | "put" | "finalize";
  readonly signNotFound?: boolean;
  readonly putAbort?: boolean;
}): {
  readonly ports: ProductPhotoUploadPorts;
  readonly calls: string[];
  readonly requestKeys: string[];
  readonly finalizeKeys: string[];
} {
  const calls: string[] = [];
  const requestKeys: string[] = [];
  const finalizeKeys: string[] = [];
  const image = prepared();
  const ports: ProductPhotoUploadPorts = {
    prepare: () => {
      calls.push("prepare");
      if (args.failAt === "prepare") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve(image);
    },
    requestUpload: (_input, options) => {
      calls.push("request");
      requestKeys.push(options.context.idempotencyKey);
      if (args.failAt === "request") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve({ fileId: FILE_A });
    },
    getUploadUrl: () => {
      calls.push("sign");
      if (args.signNotFound) {
        return Promise.reject(
          Object.assign(new Error("not found"), {
            code: "NOT_FOUND",
            status: 404,
            defined: true,
          }),
        );
      }
      if (args.failAt === "sign") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve({ fileId: FILE_A, uploadUrl: PUT_URL });
    },
    put: ({ onProgress }) => {
      calls.push("put");
      onProgress(0.5);
      if (args.putAbort) {
        const error = new Error("aborted");
        error.name = "AbortError";
        return Promise.reject(error);
      }
      if (args.failAt === "put") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      onProgress(1);
      return Promise.resolve();
    },
    finalize: (_input, options) => {
      calls.push("finalize");
      finalizeKeys.push(options.context.idempotencyKey);
      if (args.failAt === "finalize") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve({ fileId: FILE_A });
    },
    createAttempt: () => createMutationAttempt(() => crypto.randomUUID()),
  };
  return { ports, calls, requestKeys, finalizeKeys };
}

describe("reduceUpload", () => {
  it("walks request → sign → PUT → finalize to ready", () => {
    const state = drive([
      { type: "start" },
      { type: "prepared" },
      { type: "requested", fileId: FILE_A },
      { type: "signed" },
      { type: "putProgress", ratio: 0.5 },
      { type: "put" },
      { type: "finalized" },
    ]);
    expect(state.phase).toBe("ready");
    expect(state.fileId).toBe(FILE_A);
    expect(state.progress).toBe(1);
    expect(JSON.stringify(state)).not.toContain(PUT_URL);
    expect(JSON.stringify(state)).not.toContain(CHECKSUM);
  });

  it("remints getUploadUrl after a PUT network failure", () => {
    const failed = drive([
      { type: "start" },
      { type: "prepared" },
      { type: "requested", fileId: FILE_A },
      { type: "signed" },
      { type: "fail", reason: "network" },
    ]);
    expect(failed.phase).toBe("failed");
    expect(failed.checkpoint).toBe("requested");
    const retried = reduceUpload(failed, { type: "retry" });
    expect(retried.state.phase).toBe("signing");
    expect(retried.effect).toEqual({ kind: "sign" });
    expect(retried.state.fileId).toBe(FILE_A);
  });

  it("reuses the requestUpload key on a requesting network retry", () => {
    const failed = drive([
      { type: "start" },
      { type: "prepared" },
      { type: "fail", reason: "network" },
    ]);
    expect(failed.reuseRequestOnRetry).toBe(true);
    const retried = reduceUpload(failed, { type: "retry" });
    expect(retried.effect).toEqual({ kind: "request", reuseKey: true });
  });

  it("starts a new requestUpload after getUploadUrl not-found", () => {
    const failed = drive([
      { type: "start" },
      { type: "prepared" },
      { type: "requested", fileId: FILE_A },
      { type: "fail", reason: "not_found" },
    ]);
    expect(failed.fileId).toBeNull();
    expect(failed.checkpoint).toBe("prepared");
    expect(failed.reuseRequestOnRetry).toBe(false);
    const retried = reduceUpload(failed, { type: "retry" });
    expect(retried.effect).toEqual({ kind: "request", reuseKey: false });
  });

  it("reuses the finalize key after a finalize network failure", () => {
    const failed = drive([
      { type: "start" },
      { type: "prepared" },
      { type: "requested", fileId: FILE_A },
      { type: "signed" },
      { type: "put" },
      { type: "fail", reason: "network" },
    ]);
    const retried = reduceUpload(failed, { type: "retry" });
    expect(retried.state.phase).toBe("finalizing");
    expect(retried.effect).toEqual({ kind: "finalize", reuseKey: true });
  });

  it("cancels an in-flight PUT", () => {
    const putting = drive([
      { type: "start" },
      { type: "prepared" },
      { type: "requested", fileId: FILE_A },
      { type: "signed" },
    ]);
    const cancelled = reduceUpload(putting, { type: "cancel" });
    expect(cancelled.state.phase).toBe("cancelled");
    expect(cancelled.state.fileId).toBe(FILE_A);
  });
});

describe("runProductPhotoUpload", () => {
  it("runs prepare → request → sign → PUT → finalize", async () => {
    const fake = fakePorts({});
    const snapshots: UploadMachine[] = [];
    const result = await runProductPhotoUpload({
      localUri: "file:///tmp/photo.jpg",
      state: initialUploadMachine(),
      trigger: "start",
      ports: fake.ports,
      signal: new AbortController().signal,
      prepared: null,
      requestAttempt: null,
      finalizeAttempt: null,
      onState: (state) => {
        snapshots.push(state);
      },
    });
    expect(result.machine.phase).toBe("ready");
    expect(result.machine.fileId).toBe(FILE_A);
    expect(fake.calls).toEqual([
      "prepare",
      "request",
      "sign",
      "put",
      "finalize",
    ]);
    expect(JSON.stringify(snapshots)).not.toContain(PUT_URL);
    expect(JSON.stringify(snapshots)).not.toContain(CHECKSUM);
  });

  it("retries PUT by reminting the signed URL and reuses the request key", async () => {
    const first = fakePorts({ failAt: "put" });
    const failed = await runProductPhotoUpload({
      localUri: "file:///tmp/photo.jpg",
      state: initialUploadMachine(),
      trigger: "start",
      ports: first.ports,
      signal: new AbortController().signal,
      prepared: null,
      requestAttempt: null,
      finalizeAttempt: null,
      onState: () => {},
    });
    expect(failed.machine.phase).toBe("failed");
    const second = fakePorts({});
    const retried = await runProductPhotoUpload({
      localUri: "file:///tmp/photo.jpg",
      state: failed.machine,
      trigger: "retry",
      ports: second.ports,
      signal: new AbortController().signal,
      prepared: failed.prepared,
      requestAttempt: failed.requestAttempt,
      finalizeAttempt: failed.finalizeAttempt,
      onState: () => {},
    });
    expect(retried.machine.phase).toBe("ready");
    expect(second.calls).toEqual(["sign", "put", "finalize"]);
    expect(second.requestKeys).toEqual([]);
  });

  it("reuses the requestUpload idempotency key on request retry", async () => {
    const first = fakePorts({ failAt: "request" });
    const failed = await runProductPhotoUpload({
      localUri: "file:///tmp/photo.jpg",
      state: initialUploadMachine(),
      trigger: "start",
      ports: first.ports,
      signal: new AbortController().signal,
      prepared: null,
      requestAttempt: null,
      finalizeAttempt: null,
      onState: () => {},
    });
    const second = fakePorts({});
    await runProductPhotoUpload({
      localUri: "file:///tmp/photo.jpg",
      state: failed.machine,
      trigger: "retry",
      ports: second.ports,
      signal: new AbortController().signal,
      prepared: failed.prepared,
      requestAttempt: failed.requestAttempt,
      finalizeAttempt: null,
      onState: () => {},
    });
    expect(second.requestKeys).toEqual([first.requestKeys[0]]);
  });

  it("mints a new requestUpload after getUploadUrl not-found", async () => {
    const first = fakePorts({ signNotFound: true });
    const failed = await runProductPhotoUpload({
      localUri: "file:///tmp/photo.jpg",
      state: initialUploadMachine(),
      trigger: "start",
      ports: first.ports,
      signal: new AbortController().signal,
      prepared: null,
      requestAttempt: null,
      finalizeAttempt: null,
      onState: () => {},
    });
    expect(failed.machine.phase).toBe("failed");
    expect(failed.machine.fileId).toBeNull();
    expect(failed.machine.checkpoint).toBe("prepared");
    const second = fakePorts({});
    const retried = await runProductPhotoUpload({
      localUri: "file:///tmp/photo.jpg",
      state: failed.machine,
      trigger: "retry",
      ports: second.ports,
      signal: new AbortController().signal,
      prepared: failed.prepared,
      requestAttempt: failed.requestAttempt,
      finalizeAttempt: failed.finalizeAttempt,
      onState: () => {},
    });
    expect(retried.machine.phase).toBe("ready");
    expect(second.calls).toEqual(["request", "sign", "put", "finalize"]);
    expect(second.requestKeys[0]).not.toBe(first.requestKeys[0]);
  });

  it("cancels when the PUT aborts", async () => {
    const fake = fakePorts({ putAbort: true });
    const result = await runProductPhotoUpload({
      localUri: "file:///tmp/photo.jpg",
      state: initialUploadMachine(),
      trigger: "start",
      ports: fake.ports,
      signal: new AbortController().signal,
      prepared: null,
      requestAttempt: null,
      finalizeAttempt: null,
      onState: () => {},
    });
    expect(result.machine.phase).toBe("cancelled");
  });
});
