import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { files } from "@showzy/db/schema/files";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import type { getUploadUrlInputSchema } from "../actions/get-upload-url.contract.js";
import { requireDeclaredMime } from "./file-view.js";
import { catalogObjectKey, stagingObjectKey } from "./object-key.js";
import { signedPutWouldOutlivePending } from "./pending-abandon.js";
import { getFilesObjectStore } from "./s3-port.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type UploadUrlInput = z.output<typeof getUploadUrlInputSchema>;

export async function getStaffUploadUrl(input: {
  readonly ctx: StaffCtx;
  readonly input: UploadUrlInput;
}): Promise<{
  readonly fileId: string;
  readonly uploadUrl: string;
  readonly expiresAt: string;
}> {
  const rows = await input.ctx.db
    .select()
    .from(files)
    .where(
      and(
        eq(files.companyId, input.ctx.companyId),
        eq(files.id, input.input.fileId),
        eq(files.status, "pending"),
        eq(files.purpose, "catalog"),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (row === undefined) {
    throw new NotFoundError();
  }

  const expectedKey = catalogObjectKey(input.ctx.companyId, row.id);
  if (row.objectKey !== expectedKey) {
    throw new NotFoundError();
  }

  const mimeType = requireDeclaredMime(row.mimeType);
  const byteSize = Number(row.byteSize);
  if (!Number.isSafeInteger(byteSize) || byteSize < 1) {
    throw new CoreInvariantError(
      "files pending row has a non-positive declared size",
    );
  }

  if (
    signedPutWouldOutlivePending({
      createdAt: row.createdAt,
      now: new Date(),
    })
  ) {
    throw new NotFoundError();
  }

  const signed = await getFilesObjectStore().signPut({
    key: stagingObjectKey(input.ctx.companyId, row.id),
    mimeType,
    byteSize,
  });
  if (signed.url.length === 0) {
    throw new CoreInvariantError(
      "files object store returned an empty PUT URL",
    );
  }

  return {
    fileId: row.id,
    uploadUrl: signed.url,
    expiresAt: signed.expiresAt.toISOString(),
  };
}
