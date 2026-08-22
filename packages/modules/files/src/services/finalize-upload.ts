import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { files } from "@showzy/db/schema/files";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import type { finalizeUploadInputSchema } from "../actions/finalize-upload.contract.js";
import { MAX_UPLOAD_BYTES } from "../wire.contract.js";
import { sha256Hex } from "./checksum.js";
import {
  requireDeclaredMime,
  toReadyView,
  type FileReadyView,
} from "./file-view.js";
import { uploadBytesMatchDeclaredMime } from "./magic-bytes.js";
import { catalogObjectKey, stagingObjectKey } from "./object-key.js";
import { getFilesObjectStore } from "./s3-port.js";
import { uploadedObjectInvalid } from "./uploaded-object.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type FinalizeInput = z.output<typeof finalizeUploadInputSchema>;

export async function finalizeStaffUpload(input: {
  readonly ctx: StaffCtx;
  readonly input: FinalizeInput;
}): Promise<FileReadyView> {
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
    return toReadyView(row);
  }
  if (row.status !== "pending") {
    throw new CoreInvariantError("files.finalizeUpload saw an unknown status");
  }

  const catalogKey = catalogObjectKey(input.ctx.companyId, row.id);
  const stagingKey = stagingObjectKey(input.ctx.companyId, row.id);
  if (row.objectKey !== catalogKey) {
    throw uploadedObjectInvalid();
  }
  if (row.checksumSha256 === null) {
    throw uploadedObjectInvalid();
  }
  const declaredSize = Number(row.byteSize);
  if (!Number.isSafeInteger(declaredSize) || declaredSize < 1) {
    throw uploadedObjectInvalid();
  }

  const store = getFilesObjectStore();
  const head = await store.headObject(stagingKey);
  if (head === "missing") {
    throw uploadedObjectInvalid();
  }
  if (head.byteSize !== declaredSize || head.byteSize > MAX_UPLOAD_BYTES) {
    throw uploadedObjectInvalid();
  }

  const object = await store.getObject(stagingKey);
  if (object === "missing" || object.byteSize !== declaredSize) {
    throw uploadedObjectInvalid();
  }
  if (
    !uploadBytesMatchDeclaredMime(
      object.bytes,
      requireDeclaredMime(row.mimeType),
    )
  ) {
    throw uploadedObjectInvalid();
  }
  if (sha256Hex(object.bytes) !== row.checksumSha256) {
    throw uploadedObjectInvalid();
  }

  const copied = await store.copyObject({
    fromKey: stagingKey,
    toKey: catalogKey,
  });
  if (copied === "missing") {
    throw uploadedObjectInvalid();
  }

  const updated = await db
    .update(files)
    .set({
      status: "ready",
      byteSize: BigInt(object.byteSize),
      checksumSha256: row.checksumSha256,
    })
    .where(
      and(
        eq(files.companyId, input.ctx.companyId),
        eq(files.id, row.id),
        eq(files.status, "pending"),
      ),
    )
    .returning();
  const saved = updated[0];
  if (saved === undefined) {
    const raced = await db
      .select()
      .from(files)
      .where(
        and(eq(files.companyId, input.ctx.companyId), eq(files.id, row.id)),
      )
      .limit(1);
    const ready = raced[0];
    if (ready === undefined || ready.status !== "ready") {
      throw new CoreInvariantError("files.finalizeUpload lost the row");
    }
    return toReadyView(ready);
  }

  input.ctx.log.info(
    {
      file_id: saved.id,
      mime_type: saved.mimeType,
      byte_size: object.byteSize,
    },
    "files.finalizeUpload marked file ready",
  );

  return toReadyView(saved);
}
