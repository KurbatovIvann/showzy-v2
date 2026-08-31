import type { ActionCtx } from "@showzy/core";
import {
  ConflictError,
  CoreInvariantError,
  NotFoundError,
} from "@showzy/core/errors";
import { files } from "@showzy/db/schema/files";
import { sha256Hex } from "@showzy/module-kit/sha256";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import type { recordGeneratedObjectInputSchema } from "../actions/record-generated-object.contract.js";
import { MAX_DOCUMENT_BYTES } from "../wire.contract.js";
import { toDocumentReadyView, type DocumentReadyView } from "./file-view.js";
import { bytesArePdf } from "./magic-bytes.js";
import { documentObjectKey } from "./object-key.js";
import { getFilesObjectStore } from "./s3-port.js";
import { uploadedObjectInvalid } from "./uploaded-object.js";
import { requireWritable } from "./writable.js";

type SystemTenantCtx = Extract<
  ActionCtx,
  { principal: "system"; scope: "tenant" }
>;
type RecordInput = z.output<typeof recordGeneratedObjectInputSchema>;
type FileRow = typeof files.$inferSelect;

function postgresSqlState(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }
  if ("cause" in error) {
    return postgresSqlState(error.cause);
  }
  return undefined;
}

function matchingGeneratedRow(
  row: FileRow,
  input: RecordInput,
  companyId: string,
): boolean {
  return (
    row.companyId === companyId &&
    row.id === input.fileId &&
    row.status === "ready" &&
    row.purpose === "document" &&
    row.mimeType === "application/pdf" &&
    row.uploadedByUserId === null &&
    row.objectKey === documentObjectKey(companyId, input.fileId) &&
    row.checksumSha256 === input.checksumSha256 &&
    Number(row.byteSize) === input.byteSize
  );
}

export async function recordGeneratedDocumentObject(input: {
  readonly ctx: SystemTenantCtx;
  readonly input: RecordInput;
}): Promise<DocumentReadyView> {
  const db = requireWritable(input.ctx.db);
  const companyId = input.ctx.companyId;
  const fileId = input.input.fileId;
  const objectKey = documentObjectKey(companyId, fileId);

  const existing = await db
    .select()
    .from(files)
    .where(and(eq(files.companyId, companyId), eq(files.id, fileId)))
    .limit(1);
  const found = existing[0];
  if (found !== undefined) {
    if (matchingGeneratedRow(found, input.input, companyId)) {
      return toDocumentReadyView(found);
    }
    throw new ConflictError(
      "This file cannot be recorded as a generated document.",
    );
  }

  const store = getFilesObjectStore();
  const declaredSize = input.input.byteSize;
  const head = await store.headObject(objectKey);
  if (head === "missing") {
    throw new NotFoundError();
  }
  if (head.byteSize !== declaredSize || head.byteSize > MAX_DOCUMENT_BYTES) {
    throw uploadedObjectInvalid();
  }

  const object = await store.getObject(objectKey);
  if (object === "missing" || object.byteSize !== declaredSize) {
    throw uploadedObjectInvalid();
  }
  if (!bytesArePdf(object.bytes)) {
    throw uploadedObjectInvalid();
  }
  if (sha256Hex(object.bytes) !== input.input.checksumSha256) {
    throw uploadedObjectInvalid();
  }

  try {
    const inserted = await db
      .insert(files)
      .values({
        id: fileId,
        companyId,
        uploadedByUserId: null,
        purpose: "document",
        objectKey,
        mimeType: "application/pdf",
        byteSize: BigInt(input.input.byteSize),
        checksumSha256: input.input.checksumSha256,
        status: "ready",
        stagingPurgedAt: new Date(),
      })
      .returning();
    const saved = inserted[0];
    if (saved === undefined) {
      throw new CoreInvariantError(
        "files.recordGeneratedObject insert returned no row",
      );
    }

    input.ctx.log.info(
      {
        file_id: saved.id,
        purpose: saved.purpose,
        mime_type: saved.mimeType,
        byte_size: input.input.byteSize,
      },
      "files.recordGeneratedObject recorded generated document",
    );

    return toDocumentReadyView(saved);
  } catch (error) {
    if (postgresSqlState(error) !== "23505") {
      throw error;
    }
    const raced = await db
      .select()
      .from(files)
      .where(and(eq(files.companyId, companyId), eq(files.id, fileId)))
      .limit(1);
    const row = raced[0];
    if (
      row !== undefined &&
      matchingGeneratedRow(row, input.input, companyId)
    ) {
      return toDocumentReadyView(row);
    }
    throw new ConflictError(
      "This file cannot be recorded as a generated document.",
      { cause: error },
    );
  }
}
