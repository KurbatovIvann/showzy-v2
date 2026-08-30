import { randomUUID } from "node:crypto";

import type { ActionCtx } from "@showzy/core";
import { files } from "@showzy/db/schema/files";
import type { z } from "zod";

import type { requestSigningUploadInputSchema } from "../actions/request-signing-upload.contract.js";
import type { requestUploadInputSchema } from "../actions/request-upload.contract.js";
import { catalogObjectKey, signingObjectKey } from "./object-key.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type RequestInput = z.output<typeof requestUploadInputSchema>;
type SigningRequestInput = z.output<typeof requestSigningUploadInputSchema>;

export async function requestStaffUpload(input: {
  readonly ctx: StaffCtx;
  readonly input: RequestInput;
}): Promise<{
  readonly fileId: string;
}> {
  const db = requireWritable(input.ctx.db);
  const fileId = randomUUID();
  const catalogKey = catalogObjectKey(input.ctx.companyId, fileId);

  await db.insert(files).values({
    id: fileId,
    companyId: input.ctx.companyId,
    uploadedByUserId: input.ctx.userId,
    purpose: input.input.purpose,
    objectKey: catalogKey,
    mimeType: input.input.mimeType,
    byteSize: BigInt(input.input.byteSize),
    checksumSha256: input.input.checksumSha256,
    status: "pending",
  });

  input.ctx.log.info(
    {
      file_id: fileId,
      purpose: input.input.purpose,
      mime_type: input.input.mimeType,
      byte_size: input.input.byteSize,
    },
    "files.requestUpload created pending file",
  );

  return { fileId };
}

export async function requestStaffSigningUpload(input: {
  readonly ctx: StaffCtx;
  readonly input: SigningRequestInput;
}): Promise<{
  readonly fileId: string;
}> {
  const db = requireWritable(input.ctx.db);
  const fileId = randomUUID();
  const signingKey = signingObjectKey(input.ctx.companyId, fileId);

  await db.insert(files).values({
    id: fileId,
    companyId: input.ctx.companyId,
    uploadedByUserId: input.ctx.userId,
    purpose: input.input.purpose,
    objectKey: signingKey,
    mimeType: input.input.mimeType,
    byteSize: BigInt(input.input.byteSize),
    checksumSha256: input.input.checksumSha256,
    status: "pending",
  });

  input.ctx.log.info(
    {
      file_id: fileId,
      purpose: input.input.purpose,
      mime_type: input.input.mimeType,
      byte_size: input.input.byteSize,
    },
    "files.requestSigningUpload created pending file",
  );

  return { fileId };
}
