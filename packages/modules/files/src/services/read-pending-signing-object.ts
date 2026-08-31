import type { ActionCtx } from "@showzy/core";
import { NotFoundError } from "@showzy/core/errors";
import { files } from "@showzy/db/schema/files";
import { sha256Hex } from "@showzy/module-kit/sha256";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import type { readPendingSigningObjectInputSchema } from "../actions/read-pending-signing-object.contract.js";
import { MAX_DOCUMENT_BYTES, SIGNING_MIME_TYPE } from "../wire.contract.js";
import { signingObjectKey, stagingObjectKey } from "./object-key.js";
import { getFilesObjectStore } from "./s3-port.js";
import { uploadedObjectInvalid } from "./uploaded-object.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type ReadInput = z.output<typeof readPendingSigningObjectInputSchema>;
type ObjectStore = ReturnType<typeof getFilesObjectStore>;

/**
 * Prefer staging. If staging is gone after a crashed promote, read the
 * durable signing object so complete can re-verify a still-pending row.
 */
async function readSigningBytes(
  store: ObjectStore,
  key: string,
): Promise<
  { readonly bytes: Uint8Array; readonly byteSize: number } | "missing"
> {
  const head = await store.headObject(key);
  if (head === "missing") {
    return "missing";
  }
  if (head.byteSize > MAX_DOCUMENT_BYTES) {
    throw uploadedObjectInvalid();
  }
  const object = await store.getObject(key);
  if (object === "missing" || object.byteSize !== head.byteSize) {
    throw uploadedObjectInvalid();
  }
  if (object.byteSize > MAX_DOCUMENT_BYTES) {
    throw uploadedObjectInvalid();
  }
  return { bytes: object.bytes, byteSize: object.byteSize };
}

export async function readStaffPendingSigningObject(input: {
  readonly ctx: StaffCtx;
  readonly input: ReadInput;
}): Promise<{
  readonly fileId: string;
  readonly mimeType: typeof SIGNING_MIME_TYPE;
  readonly byteSize: number;
  readonly checksumSha256: string;
  readonly bytes: Uint8Array;
}> {
  const companyId = input.ctx.companyId;
  const fileId = input.input.fileId;
  const rows = await input.ctx.db
    .select({
      id: files.id,
      purpose: files.purpose,
      status: files.status,
      mimeType: files.mimeType,
    })
    .from(files)
    .where(and(eq(files.companyId, companyId), eq(files.id, fileId)))
    .limit(1);
  const found = rows[0];
  if (
    found === undefined ||
    found.purpose !== "signing" ||
    found.status !== "pending" ||
    found.mimeType !== SIGNING_MIME_TYPE
  ) {
    throw new NotFoundError();
  }

  const store = getFilesObjectStore();
  const staging = await readSigningBytes(
    store,
    stagingObjectKey(companyId, fileId),
  );
  const loaded =
    staging === "missing"
      ? await readSigningBytes(store, signingObjectKey(companyId, fileId))
      : staging;
  if (loaded === "missing") {
    throw new NotFoundError();
  }

  return {
    fileId,
    mimeType: SIGNING_MIME_TYPE,
    byteSize: loaded.byteSize,
    checksumSha256: sha256Hex(loaded.bytes),
    bytes: loaded.bytes,
  };
}
