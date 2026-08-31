/**
 * `catalog.setProductImages` loop for the photo session (SHO-158).
 * Session context owns the plan; this driver owns submit/retry/reset.
 */
import { describeQueryFailure } from "../../../../api/errors";

import type { PhotoFlushOutcome } from "./product-photos-plan";
import {
  selectPhotoSessionCommitPlan,
  selectPhotoSessionFlushOutcome,
  type PhotoSessionContext,
  type PhotoSessionEvent,
} from "./product-photos-session";

export type ProductPhotosFlushResult = PhotoFlushOutcome;

export type PhotoCommitPorts = {
  getContext: () => PhotoSessionContext;
  send: (event: PhotoSessionEvent) => void;
  submit: (input: {
    readonly productId: string;
    readonly fileIds: readonly string[];
  }) => Promise<{ readonly fileIds: readonly string[] }>;
  retry: () => Promise<{ readonly fileIds: readonly string[] }>;
  reset: () => void;
  invalidate: () => Promise<void>;
  onSettled: () => void;
};

export async function runPhotoCommitLoop(
  ports: PhotoCommitPorts,
): Promise<void> {
  if (ports.getContext().commitBusy) {
    ports.send({ type: "queueCommit" });
    return;
  }
  ports.send({ type: "beginCommit" });
  try {
    do {
      ports.send({ type: "clearCommitQueue" });
      try {
        const plan = selectPhotoSessionCommitPlan(ports.getContext());
        if (plan.kind === "noop") {
          ports.send({ type: "commitNoop" });
          ports.reset();
          continue;
        }
        if (plan.kind === "write") {
          ports.send({ type: "noteWrite", fileIds: [...plan.fileIds] });
        }
        const output =
          plan.kind === "write"
            ? await ports.submit({
                productId: plan.productId,
                fileIds: plan.fileIds,
              })
            : await ports.retry();
        ports.send({
          type: "commitSucceeded",
          fileIds: [...output.fileIds],
        });
        ports.reset();
        await ports.invalidate();
      } catch (error: unknown) {
        // A queued follow-up must still run: an exception used to
        // leave `commitQueued` stale and drop the next write (SHO-302).
        ports.send({
          type: "commitFailed",
          kind: describeQueryFailure(error).kind,
        });
      }
    } while (ports.getContext().commitQueued);
  } finally {
    ports.send({ type: "finishCommit" });
    ports.onSettled();
  }
}

export async function flushPhotoSession(args: {
  readonly kickIdle: () => void;
  readonly waitUntilSettled: () => Promise<void>;
  readonly commitIfNeeded: () => Promise<void>;
  readonly getContext: () => PhotoSessionContext;
  readonly send: (event: PhotoSessionEvent) => void;
}): Promise<ProductPhotosFlushResult> {
  args.kickIdle();
  await args.waitUntilSettled();
  await args.commitIfNeeded();
  await args.waitUntilSettled();
  const outcome = selectPhotoSessionFlushOutcome(args.getContext());
  if (outcome === "ok") {
    args.send({ type: "clearFailure" });
  }
  return outcome;
}
