import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { files } from "@showzy/db/schema/files";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import type { sweepAbandonedUploadsInputSchema } from "../actions/sweep-abandoned-uploads.contract.js";
import { ABANDONED_PENDING_TTL_MS } from "../actions/sweep-abandoned-uploads.contract.js";
import { catalogObjectKey, stagingObjectKey } from "./object-key.js";
import { getFilesObjectStore } from "./s3-port.js";
import { requireWritable } from "./writable.js";

type SystemTenantCtx = Extract<
  ActionCtx,
  { principal: "system"; scope: "tenant" }
>;
type SweepInput = z.output<typeof sweepAbandonedUploadsInputSchema>;

export interface SweepAbandonedUploadResult {
  readonly fileId: string;
  readonly deletedPendingRow: boolean;
  readonly deletedStaging: boolean;
  readonly deletedCatalog: boolean;
}

export async function sweepAbandonedUpload(input: {
  readonly ctx: SystemTenantCtx;
  readonly input: SweepInput;
}): Promise<SweepAbandonedUploadResult> {
  const db = requireWritable(input.ctx.db);
  const rows = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.companyId, input.ctx.companyId),
        eq(files.id, input.input.fileId),
      ),
    )
    .limit(1)
    .for("update");
  const row = rows[0];
  if (row === undefined) {
    throw new NotFoundError();
  }

  if (row.status === "ready") {
    await getFilesObjectStore().deleteObject(
      stagingObjectKey(row.companyId, row.id),
    );
    input.ctx.log.info(
      { file_id: row.id, outcome: "leftover_staging" },
      "files.sweepAbandonedUploads deleted leftover staging",
    );
    return {
      fileId: row.id,
      deletedPendingRow: false,
      deletedStaging: true,
      deletedCatalog: false,
    };
  }

  if (row.status !== "pending") {
    throw new CoreInvariantError(
      "files.sweepAbandonedUploads saw an unknown status",
    );
  }

  const cutoff = Date.now() - ABANDONED_PENDING_TTL_MS;
  if (row.createdAt.getTime() > cutoff) {
    return {
      fileId: row.id,
      deletedPendingRow: false,
      deletedStaging: false,
      deletedCatalog: false,
    };
  }

  const store = getFilesObjectStore();
  await store.deleteObject(stagingObjectKey(row.companyId, row.id));
  await store.deleteObject(catalogObjectKey(row.companyId, row.id));

  const deleted = await db
    .delete(files)
    .where(
      and(
        eq(files.companyId, input.ctx.companyId),
        eq(files.id, row.id),
        eq(files.status, "pending"),
      ),
    )
    .returning({ id: files.id });
  if (deleted[0] === undefined) {
    throw new CoreInvariantError(
      "files.sweepAbandonedUploads lost the pending row",
    );
  }

  input.ctx.log.info(
    { file_id: row.id, outcome: "abandoned_pending" },
    "files.sweepAbandonedUploads deleted abandoned pending upload",
  );

  return {
    fileId: row.id,
    deletedPendingRow: true,
    deletedStaging: true,
    deletedCatalog: true,
  };
}
