import type { ActionCtx } from "@showzy/core";
import {
  ConflictError,
  CoreInvariantError,
  NotFoundError,
} from "@showzy/core/errors";
import { files } from "@showzy/db/schema/files";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import type { recordSigningObjectInputSchema } from "../actions/record-signing-object.contract.js";
import { MAX_DOCUMENT_BYTES } from "../wire.contract.js";
import { sha256Hex } from "./checksum.js";
import { toSigningReadyView, type SigningReadyView } from "./file-view.js";
import { bytesAreAsicContainer } from "./magic-bytes.js";
import { signingObjectKey, stagingObjectKey } from "./object-key.js";
import { getFilesObjectStore } from "./s3-port.js";
import { uploadedObjectInvalid } from "./uploaded-object.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type RecordInput = z.output<typeof recordSigningObjectInputSchema>;
type FileRow = typeof files.$inferSelect;

function matchingSigningRow(
  row: FileRow,
  input: RecordInput,
  companyId: string,
  userId: string,
): boolean {
  return (
    row.companyId === companyId &&
    row.id === input.fileId &&
    row.status === "ready" &&
    row.purpose === "signing" &&
    row.mimeType === "application/vnd.etsi.asic-e+zip" &&
    row.uploadedByUserId === userId &&
    row.objectKey === signingObjectKey(companyId, input.fileId) &&
    row.checksumSha256 === input.checksumSha256 &&
    Number(row.byteSize) === input.byteSize
  );
}

export async function recordStaffSigningObject(input: {
  readonly ctx: StaffCtx;
  readonly input: RecordInput;
}): Promise<SigningReadyView> {
  const db = requireWritable(input.ctx.db);
  const companyId = input.ctx.companyId;
  const userId = input.ctx.userId;
  const fileId = input.input.fileId;
  const durableKey = signingObjectKey(companyId, fileId);
  const stagingKey = stagingObjectKey(companyId, fileId);

  const existing = await db
    .select()
    .from(files)
    .where(and(eq(files.companyId, companyId), eq(files.id, fileId)))
    .limit(1);
  const found = existing[0];
  if (found === undefined) {
    throw new NotFoundError();
  }
  if (found.purpose !== "signing") {
    throw new NotFoundError();
  }
  if (found.status === "ready") {
    if (matchingSigningRow(found, input.input, companyId, userId)) {
      return toSigningReadyView(found);
    }
    throw new ConflictError(
      "This file cannot be recorded as a signing object.",
    );
  }
  if (found.status !== "pending") {
    throw new CoreInvariantError(
      "files.recordSigningObject saw an unknown status",
    );
  }
  if (
    found.objectKey !== durableKey ||
    found.uploadedByUserId !== userId ||
    found.mimeType !== input.input.mimeType ||
    found.checksumSha256 !== input.input.checksumSha256 ||
    Number(found.byteSize) !== input.input.byteSize
  ) {
    throw new ConflictError(
      "This file cannot be recorded as a signing object.",
    );
  }

  const store = getFilesObjectStore();
  const declaredSize = input.input.byteSize;
  const head = await store.headObject(stagingKey);
  if (head === "missing") {
    throw new NotFoundError();
  }
  if (head.byteSize !== declaredSize || head.byteSize > MAX_DOCUMENT_BYTES) {
    throw uploadedObjectInvalid();
  }

  const object = await store.getObject(stagingKey);
  if (object === "missing" || object.byteSize !== declaredSize) {
    throw uploadedObjectInvalid();
  }
  if (!bytesAreAsicContainer(object.bytes)) {
    throw uploadedObjectInvalid();
  }
  if (sha256Hex(object.bytes) !== input.input.checksumSha256) {
    throw uploadedObjectInvalid();
  }

  await store.putObject({
    key: durableKey,
    mimeType: input.input.mimeType,
    bytes: object.bytes,
  });

  const updated = await db
    .update(files)
    .set({
      status: "ready",
      byteSize: BigInt(input.input.byteSize),
      checksumSha256: input.input.checksumSha256,
      uploadedByUserId: userId,
      // Catalog leftover GC is purpose=catalog only. Generated PDFs set
      // this at insert; signing handshake leftover is not that sweeper's
      // job, so mark the cursor here (SHO-253).
      stagingPurgedAt: new Date(),
    })
    .where(
      and(
        eq(files.companyId, companyId),
        eq(files.id, fileId),
        eq(files.status, "pending"),
        eq(files.purpose, "signing"),
      ),
    )
    .returning();
  const saved = updated[0];
  if (saved === undefined) {
    const raced = await db
      .select()
      .from(files)
      .where(and(eq(files.companyId, companyId), eq(files.id, fileId)))
      .limit(1);
    const row = raced[0];
    if (
      row !== undefined &&
      matchingSigningRow(row, input.input, companyId, userId)
    ) {
      return toSigningReadyView(row);
    }
    throw new ConflictError(
      "This file cannot be recorded as a signing object.",
    );
  }

  input.ctx.log.info(
    {
      file_id: saved.id,
      purpose: saved.purpose,
      mime_type: saved.mimeType,
      byte_size: input.input.byteSize,
    },
    "files.recordSigningObject recorded signing object",
  );

  return toSigningReadyView(saved);
}
