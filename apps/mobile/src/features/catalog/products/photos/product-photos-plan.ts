/**
 * Photo commit plan and flush outcome (SHO-303). Slot algebra stays in
 * `product-photos-slots.ts`.
 */
import type { QueryFailureKind } from "../../../../api/errors";
import {
  fileIdsEqual,
  hasUnreadyPhotoUploads,
  readyOrderedFileIds,
  type PhotoSlot,
} from "./product-photos-slots";

export type PhotoCommitPlan =
  | { readonly kind: "noop" }
  | { readonly kind: "retry" }
  | {
      readonly kind: "write";
      readonly productId: string;
      readonly fileIds: readonly string[];
    };

export type PhotoFlushOutcome = "ok" | "commit-failed" | "upload-failed";

const RETRYABLE_FAILURE: ReadonlySet<QueryFailureKind> = new Set([
  "network",
  "offline",
  "timeout",
  "rate_limited",
  "internal",
]);

export function planPhotoCommit(args: {
  readonly productId: string | null;
  readonly slots: readonly PhotoSlot[];
  readonly lastCommitted: readonly string[] | null;
  readonly lastWrite: readonly string[] | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly canRetryAttempt: boolean;
}): PhotoCommitPlan {
  if (args.productId === null) {
    return { kind: "noop" };
  }
  const fileIds = readyOrderedFileIds(args.slots);
  const retryable =
    args.lastFailureKind !== null &&
    RETRYABLE_FAILURE.has(args.lastFailureKind);
  if (
    args.canRetryAttempt &&
    args.lastWrite !== null &&
    fileIdsEqual(args.lastWrite, fileIds) &&
    retryable
  ) {
    return { kind: "retry" };
  }
  if (
    args.lastCommitted !== null &&
    fileIdsEqual(args.lastCommitted, fileIds)
  ) {
    return { kind: "noop" };
  }
  return {
    kind: "write",
    productId: args.productId,
    fileIds,
  };
}

/**
 * After `commitIfNeeded`, save may still `flush`. Matching ready ids are
 * not enough: a failed or otherwise unready pick is `"upload-failed"`.
 * If the user removed that pick so ready ids match the server, a prior
 * replace failure may still be `"ok"` (undo).
 */
export function photoFlushOutcome(args: {
  readonly planKind: PhotoCommitPlan["kind"];
  readonly lastFailureKind: QueryFailureKind | null;
  readonly slots: readonly PhotoSlot[];
}): PhotoFlushOutcome {
  if (hasUnreadyPhotoUploads(args.slots)) {
    return "upload-failed";
  }
  if (args.planKind === "noop") {
    return "ok";
  }
  return args.lastFailureKind === null ? "ok" : "commit-failed";
}
