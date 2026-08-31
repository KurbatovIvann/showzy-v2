import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { files } from "@showzy/db/schema/files";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import type { getSigningUploadUrlInputSchema } from "../actions/get-signing-upload-url.contract.js";
import type { getUploadUrlInputSchema } from "../actions/get-upload-url.contract.js";
import { catalogFilePurpose, signingFilePurpose } from "./file-purpose.js";
import { stagingObjectKey } from "./object-key.js";
import { signedPutWouldOutlivePending } from "./pending-abandon.js";
import { getFilesObjectStore } from "./s3-port.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type UploadUrlInput = z.output<typeof getUploadUrlInputSchema>;
type SigningUploadUrlInput = z.output<typeof getSigningUploadUrlInputSchema>;

type HandshakeUploadPurpose =
  typeof catalogFilePurpose | typeof signingFilePurpose;

async function getStaffHandshakeUploadUrl(input: {
  readonly ctx: StaffCtx;
  readonly fileId: string;
  readonly purpose: HandshakeUploadPurpose;
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
        eq(files.id, input.fileId),
        eq(files.status, "pending"),
        eq(files.purpose, input.purpose.purpose),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (row === undefined) {
    throw new NotFoundError();
  }

  const expectedKey = input.purpose.objectKey(input.ctx.companyId, row.id);
  if (row.objectKey !== expectedKey) {
    throw new NotFoundError();
  }

  const mimeType = input.purpose.requireMime(row.mimeType);
  const byteSize = Number(row.byteSize);
  if (!Number.isSafeInteger(byteSize) || byteSize < 1) {
    throw new CoreInvariantError(input.purpose.pendingSizeInvariant);
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

export async function getStaffUploadUrl(input: {
  readonly ctx: StaffCtx;
  readonly input: UploadUrlInput;
}): Promise<{
  readonly fileId: string;
  readonly uploadUrl: string;
  readonly expiresAt: string;
}> {
  return getStaffHandshakeUploadUrl({
    ctx: input.ctx,
    fileId: input.input.fileId,
    purpose: catalogFilePurpose,
  });
}

export async function getStaffSigningUploadUrl(input: {
  readonly ctx: StaffCtx;
  readonly input: SigningUploadUrlInput;
}): Promise<{
  readonly fileId: string;
  readonly uploadUrl: string;
  readonly expiresAt: string;
}> {
  return getStaffHandshakeUploadUrl({
    ctx: input.ctx,
    fileId: input.input.fileId,
    purpose: signingFilePurpose,
  });
}
