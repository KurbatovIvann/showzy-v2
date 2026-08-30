import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { files } from "@showzy/db/schema/files";
import { and, asc, eq, inArray, isNull, lte } from "drizzle-orm";
import type { z } from "zod";

import {
  SWEEP_BATCH_LIMIT,
  type sweepAbandonedUploadsInputSchema,
} from "../actions/sweep-abandoned-uploads.contract.js";
import {
  catalogObjectKey,
  signingObjectKey,
  stagingObjectKey,
} from "./object-key.js";
import { abandonedPendingCutoff } from "./pending-abandon.js";
import { getFilesObjectStore, type FilesObjectStore } from "./s3-port.js";
import { requireWritable } from "./writable.js";

const ABANDONED_PENDING_PURPOSES = ["catalog", "signing"] as const;

type SystemGlobalCtx = Extract<
  ActionCtx,
  { principal: "system"; scope: "global" }
>;
type SweepInput = z.output<typeof sweepAbandonedUploadsInputSchema>;
type FileRow = typeof files.$inferSelect;
type WritableDb = ReturnType<typeof requireWritable>;

export interface SweepAbandonedUploadsResult {
  readonly leftoverStagingDeleted: number;
  readonly abandonedPendingDeleted: number;
}

export async function runAbandonedUploadSweep(input: {
  readonly ctx: SystemGlobalCtx;
  readonly input: SweepInput;
}): Promise<SweepAbandonedUploadsResult> {
  const db = requireWritable(input.ctx.db);
  const limit = input.input.limit ?? SWEEP_BATCH_LIMIT;
  const cutoff = abandonedPendingCutoff(new Date());
  const store = getFilesObjectStore();

  // Row age from createdAt. getUploadUrl / getSigningUploadUrl are
  // risk:read and cannot extend this lease; they refuse a remint whose
  // PUT would outlive this cutoff. Signing pending is collected here so
  // that cutoff has a collector; ready leftover GC stays catalog-only
  // and never deletes {companyId}/signing/{fileId}.
  const abandoned = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.status, "pending"),
        inArray(files.purpose, [...ABANDONED_PENDING_PURPOSES]),
        lte(files.createdAt, cutoff),
      ),
    )
    .orderBy(asc(files.createdAt), asc(files.id))
    .limit(limit)
    .for("update", { skipLocked: true });

  const remaining = limit - abandoned.length;
  const ready =
    remaining > 0
      ? await db
          .select()
          .from(files)
          .where(
            and(
              eq(files.status, "ready"),
              eq(files.purpose, "catalog"),
              isNull(files.stagingPurgedAt),
            ),
          )
          .orderBy(asc(files.updatedAt), asc(files.id))
          .limit(remaining)
          .for("update", { skipLocked: true })
      : [];

  let leftoverStagingDeleted = 0;
  let abandonedPendingDeleted = 0;

  for (const row of abandoned) {
    const deleted = await sweepAbandonedPending({ db, store, row });
    if (deleted) {
      abandonedPendingDeleted += 1;
    }
  }

  for (const row of ready) {
    const deletedStaging = await sweepReadyLeftoverStaging({ db, store, row });
    if (deletedStaging) {
      leftoverStagingDeleted += 1;
    }
  }

  input.ctx.log.info(
    {
      leftover_staging_deleted: leftoverStagingDeleted,
      abandoned_pending_deleted: abandonedPendingDeleted,
    },
    "files.sweepAbandonedUploads finished",
  );

  return { leftoverStagingDeleted, abandonedPendingDeleted };
}

async function sweepAbandonedPending(input: {
  readonly db: WritableDb;
  readonly store: FilesObjectStore;
  readonly row: FileRow;
}): Promise<boolean> {
  if (input.row.status !== "pending") {
    throw new CoreInvariantError(
      "files.sweepAbandonedUploads expected a pending row",
    );
  }
  if (input.row.purpose !== "catalog" && input.row.purpose !== "signing") {
    throw new CoreInvariantError(
      "files.sweepAbandonedUploads expected a catalog or signing pending row",
    );
  }

  await deleteIfPresent(
    input.store,
    stagingObjectKey(input.row.companyId, input.row.id),
  );
  if (input.row.purpose === "catalog") {
    await deleteIfPresent(
      input.store,
      catalogObjectKey(input.row.companyId, input.row.id),
    );
  } else {
    // Failed recordSigningObject can leave bytes on the signing prefix
    // while the row is still pending. Unsigned ZIP staging is never
    // copied here as durable.
    await deleteIfPresent(
      input.store,
      signingObjectKey(input.row.companyId, input.row.id),
    );
  }

  const deleted = await input.db
    .delete(files)
    .where(
      and(
        eq(files.companyId, input.row.companyId),
        eq(files.id, input.row.id),
        eq(files.status, "pending"),
      ),
    )
    .returning({ id: files.id });
  if (deleted[0] === undefined) {
    throw new CoreInvariantError(
      "files.sweepAbandonedUploads lost the pending row",
    );
  }
  return true;
}

async function sweepReadyLeftoverStaging(input: {
  readonly db: WritableDb;
  readonly store: FilesObjectStore;
  readonly row: FileRow;
}): Promise<boolean> {
  if (input.row.status !== "ready") {
    throw new CoreInvariantError(
      "files.sweepAbandonedUploads expected a ready row",
    );
  }

  const deletedStaging = await deleteIfPresent(
    input.store,
    stagingObjectKey(input.row.companyId, input.row.id),
  );
  const marked = await input.db
    .update(files)
    .set({ stagingPurgedAt: new Date() })
    .where(
      and(
        eq(files.companyId, input.row.companyId),
        eq(files.id, input.row.id),
        eq(files.status, "ready"),
        isNull(files.stagingPurgedAt),
      ),
    )
    .returning({ id: files.id });
  if (marked[0] === undefined) {
    throw new CoreInvariantError(
      "files.sweepAbandonedUploads lost the ready leftover row",
    );
  }
  return deletedStaging;
}

async function deleteIfPresent(
  store: FilesObjectStore,
  key: string,
): Promise<boolean> {
  const head = await store.headObject(key);
  // DeleteObject is idempotent. Garage can miss HeadObject after PutObject;
  // a HEAD-gated skip leaves leftover staging (SHO-143 CI leftover sweep).
  await store.deleteObject(key);
  return head !== "missing";
}
