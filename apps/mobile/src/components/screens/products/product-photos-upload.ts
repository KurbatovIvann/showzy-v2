/**
 * Per-image upload handshake (SHO-141). Pure state machine so request →
 * sign → PUT → finalize, retry, and cancel are unit-testable. Signed
 * URLs and checksums never live on this state (ticket: never log them).
 */
import type { MutationAttempt, MutationCallOptions } from "@showzy/contract";

import {
  describeQueryFailure,
  type QueryFailureKind,
} from "../../../api/errors";
import { FILE_PURPOSE, type CatalogImageMime } from "./product-photos-limits";

export class CatalogImagePrepareError extends Error {
  readonly reason: "validation" | "unavailable";

  constructor(reason: "validation" | "unavailable") {
    super("prepare");
    this.name = "CatalogImagePrepareError";
    this.reason = reason;
  }
}

export type UploadPhase =
  | "idle"
  | "preparing"
  | "requesting"
  | "signing"
  | "putting"
  | "finalizing"
  | "ready"
  | "failed"
  | "cancelled";

/**
 * Durable handshake progress. `signed` is ephemeral (the URL is not
 * stored). After `requested`, a failed PUT remints `getUploadUrl`.
 * After `put`, finalize is idempotent on the same key.
 */
export type UploadCheckpoint = "none" | "prepared" | "requested" | "put";

export type UploadFailureKind =
  | "network"
  | "offline"
  | "validation"
  | "permission"
  | "not_found"
  | "unavailable";

export type UploadMachine = {
  readonly phase: UploadPhase;
  readonly checkpoint: UploadCheckpoint;
  readonly fileId: string | null;
  readonly progress: number;
  readonly failure: UploadFailureKind | null;
  /** Reuse `requestUpload` idempotency key on network retry of that write. */
  readonly reuseRequestOnRetry: boolean;
};

export type UploadEvent =
  | { readonly type: "start" }
  | { readonly type: "prepared" }
  | { readonly type: "requested"; readonly fileId: string }
  | { readonly type: "signed" }
  | { readonly type: "putProgress"; readonly ratio: number }
  | { readonly type: "put" }
  | { readonly type: "finalized" }
  | { readonly type: "fail"; readonly reason: UploadFailureKind }
  | { readonly type: "retry" }
  | { readonly type: "cancel" };

export type UploadEffect =
  | { readonly kind: "prepare" }
  | { readonly kind: "request"; readonly reuseKey: boolean }
  | { readonly kind: "sign" }
  | { readonly kind: "put" }
  | { readonly kind: "finalize"; readonly reuseKey: boolean }
  | { readonly kind: "none" };

export type PreparedCatalogImage = {
  readonly uri: string;
  readonly mimeType: CatalogImageMime;
  readonly byteSize: number;
  readonly checksumSha256: string;
};

export type ProductPhotoUploadPorts = {
  readonly prepare: (localUri: string) => Promise<PreparedCatalogImage>;
  readonly requestUpload: (
    input: {
      readonly purpose: typeof FILE_PURPOSE;
      readonly mimeType: CatalogImageMime;
      readonly byteSize: number;
      readonly checksumSha256: string;
    },
    options: MutationCallOptions,
  ) => Promise<{ readonly fileId: string }>;
  readonly getUploadUrl: (input: {
    readonly fileId: string;
  }) => Promise<{ readonly fileId: string; readonly uploadUrl: string }>;
  readonly put: (args: {
    readonly uri: string;
    readonly uploadUrl: string;
    readonly mimeType: CatalogImageMime;
    readonly signal: AbortSignal;
    readonly onProgress: (ratio: number) => void;
  }) => Promise<void>;
  readonly finalize: (
    input: { readonly fileId: string },
    options: MutationCallOptions,
  ) => Promise<{ readonly fileId: string }>;
  readonly createAttempt: () => MutationAttempt;
};

export function initialUploadMachine(): UploadMachine {
  return {
    phase: "idle",
    checkpoint: "none",
    fileId: null,
    progress: 0,
    failure: null,
    reuseRequestOnRetry: false,
  };
}

export function reduceUpload(
  state: UploadMachine,
  event: UploadEvent,
): { readonly state: UploadMachine; readonly effect: UploadEffect } {
  if (state.phase === "cancelled") {
    return { state, effect: { kind: "none" } };
  }
  if (state.phase === "ready" && event.type !== "cancel") {
    return { state, effect: { kind: "none" } };
  }

  switch (event.type) {
    case "start":
      return {
        state: {
          phase: "preparing",
          checkpoint: "none",
          fileId: null,
          progress: 0.04,
          failure: null,
          reuseRequestOnRetry: false,
        },
        effect: { kind: "prepare" },
      };
    case "prepared":
      return {
        state: {
          ...state,
          phase: "requesting",
          checkpoint: "prepared",
          progress: 0.1,
          failure: null,
          reuseRequestOnRetry: false,
        },
        effect: { kind: "request", reuseKey: false },
      };
    case "requested":
      return {
        state: {
          ...state,
          phase: "signing",
          checkpoint: "requested",
          fileId: event.fileId,
          progress: 0.16,
          failure: null,
        },
        effect: { kind: "sign" },
      };
    case "signed":
      return {
        state: {
          ...state,
          phase: "putting",
          progress: 0.2,
          failure: null,
        },
        effect: { kind: "put" },
      };
    case "putProgress":
      if (state.phase !== "putting") {
        return { state, effect: { kind: "none" } };
      }
      return {
        state: {
          ...state,
          progress: 0.2 + 0.6 * clamp01(event.ratio),
        },
        effect: { kind: "none" },
      };
    case "put":
      return {
        state: {
          ...state,
          phase: "finalizing",
          checkpoint: "put",
          progress: 0.86,
          failure: null,
        },
        effect: { kind: "finalize", reuseKey: false },
      };
    case "finalized":
      return {
        state: {
          ...state,
          phase: "ready",
          checkpoint: "put",
          progress: 1,
          failure: null,
        },
        effect: { kind: "none" },
      };
    case "fail":
      return {
        state: failState(state, event.reason),
        effect: { kind: "none" },
      };
    case "retry":
      return retryUpload(state);
    case "cancel":
      return {
        state: {
          ...state,
          phase: "cancelled",
          progress: 0,
          failure: null,
        },
        effect: { kind: "none" },
      };
  }
}

function failState(
  state: UploadMachine,
  reason: UploadFailureKind,
): UploadMachine {
  if (reason === "not_found" && state.checkpoint === "requested") {
    return {
      phase: "failed",
      checkpoint: "prepared",
      fileId: null,
      progress: state.progress,
      failure: reason,
      reuseRequestOnRetry: false,
    };
  }
  return {
    ...state,
    phase: "failed",
    failure: reason,
    reuseRequestOnRetry:
      state.phase === "requesting" ? true : state.reuseRequestOnRetry,
  };
}

function retryUpload(state: UploadMachine): {
  readonly state: UploadMachine;
  readonly effect: UploadEffect;
} {
  if (state.phase !== "failed") {
    return { state, effect: { kind: "none" } };
  }
  if (state.checkpoint === "put" && state.fileId !== null) {
    return {
      state: {
        ...state,
        phase: "finalizing",
        progress: 0.86,
        failure: null,
      },
      effect: { kind: "finalize", reuseKey: true },
    };
  }
  if (state.checkpoint === "requested" && state.fileId !== null) {
    return {
      state: {
        ...state,
        phase: "signing",
        progress: 0.16,
        failure: null,
      },
      effect: { kind: "sign" },
    };
  }
  if (state.checkpoint === "prepared") {
    return {
      state: {
        ...state,
        phase: "requesting",
        fileId: null,
        progress: 0.1,
        failure: null,
      },
      effect: { kind: "request", reuseKey: state.reuseRequestOnRetry },
    };
  }
  return {
    state: {
      phase: "preparing",
      checkpoint: "none",
      fileId: null,
      progress: 0.04,
      failure: null,
      reuseRequestOnRetry: false,
    },
    effect: { kind: "prepare" },
  };
}

export function mapUploadFailure(error: unknown): UploadFailureKind {
  if (error instanceof CatalogImagePrepareError) {
    return error.reason;
  }
  const kind = describeQueryFailure(error).kind;
  return failureFromQueryKind(kind);
}

export function failureFromQueryKind(
  kind: QueryFailureKind,
): UploadFailureKind {
  switch (kind) {
    case "network":
      return "network";
    case "offline":
      return "offline";
    case "validation":
      return "validation";
    case "permission":
      return "permission";
    case "not_found":
      return "not_found";
    default:
      return "unavailable";
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError")
  );
}

export async function runProductPhotoUpload(args: {
  readonly localUri: string;
  readonly state: UploadMachine;
  readonly trigger: "start" | "retry";
  readonly ports: ProductPhotoUploadPorts;
  readonly signal: AbortSignal;
  readonly prepared: PreparedCatalogImage | null;
  readonly requestAttempt: MutationAttempt | null;
  readonly finalizeAttempt: MutationAttempt | null;
  readonly onState: (state: UploadMachine) => void;
}): Promise<{
  readonly machine: UploadMachine;
  readonly prepared: PreparedCatalogImage | null;
  readonly requestAttempt: MutationAttempt | null;
  readonly finalizeAttempt: MutationAttempt | null;
}> {
  let current = args.state;
  let step = reduceUpload(
    current,
    args.trigger === "retry" ? { type: "retry" } : { type: "start" },
  );
  current = step.state;
  args.onState(current);

  let prepared = args.prepared;
  let requestAttempt = args.requestAttempt;
  let finalizeAttempt = args.finalizeAttempt;
  let uploadUrl: string | null = null;

  while (step.effect.kind !== "none") {
    if (args.signal.aborted || current.phase === "cancelled") {
      step = reduceUpload(current, { type: "cancel" });
      current = step.state;
      args.onState(current);
      return {
        machine: current,
        prepared,
        requestAttempt,
        finalizeAttempt,
      };
    }
    try {
      switch (step.effect.kind) {
        case "prepare": {
          prepared = await args.ports.prepare(args.localUri);
          step = reduceUpload(current, { type: "prepared" });
          break;
        }
        case "request": {
          const image = requirePrepared(prepared);
          if (!step.effect.reuseKey || requestAttempt === null) {
            requestAttempt = args.ports.createAttempt();
          }
          const output = await args.ports.requestUpload(
            {
              purpose: FILE_PURPOSE,
              mimeType: image.mimeType,
              byteSize: image.byteSize,
              checksumSha256: image.checksumSha256,
            },
            requestAttempt.options,
          );
          step = reduceUpload(current, {
            type: "requested",
            fileId: output.fileId,
          });
          break;
        }
        case "sign": {
          const fileId = requireFileId(current.fileId);
          const signed = await args.ports.getUploadUrl({ fileId });
          uploadUrl = signed.uploadUrl;
          step = reduceUpload(current, { type: "signed" });
          break;
        }
        case "put": {
          const image = requirePrepared(prepared);
          const url = uploadUrl;
          if (url === null) {
            throw new TypeError("Failed to fetch");
          }
          await args.ports.put({
            uri: image.uri,
            uploadUrl: url,
            mimeType: image.mimeType,
            signal: args.signal,
            onProgress: (ratio) => {
              const next = reduceUpload(current, {
                type: "putProgress",
                ratio,
              });
              current = next.state;
              args.onState(current);
            },
          });
          step = reduceUpload(current, { type: "put" });
          break;
        }
        case "finalize": {
          const fileId = requireFileId(current.fileId);
          if (!step.effect.reuseKey || finalizeAttempt === null) {
            finalizeAttempt = args.ports.createAttempt();
          }
          await args.ports.finalize({ fileId }, finalizeAttempt.options);
          step = reduceUpload(current, { type: "finalized" });
          break;
        }
      }
    } catch (error: unknown) {
      if (args.signal.aborted || isAbortError(error)) {
        step = reduceUpload(current, { type: "cancel" });
        current = step.state;
        args.onState(current);
        return {
          machine: current,
          prepared,
          requestAttempt,
          finalizeAttempt,
        };
      }
      step = reduceUpload(current, {
        type: "fail",
        reason: mapUploadFailure(error),
      });
    }
    current = step.state;
    args.onState(current);
  }
  return {
    machine: current,
    prepared,
    requestAttempt,
    finalizeAttempt,
  };
}

function requirePrepared(
  prepared: PreparedCatalogImage | null,
): PreparedCatalogImage {
  if (prepared === null) {
    throw new TypeError("Failed to fetch");
  }
  return prepared;
}

function requireFileId(fileId: string | null): string {
  if (fileId === null) {
    throw new TypeError("Failed to fetch");
  }
  return fileId;
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}
