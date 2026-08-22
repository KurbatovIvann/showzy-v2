import { randomUUID } from "node:crypto";

import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { files } from "@showzy/db/schema/files";
import type { z } from "zod";

import type { requestUploadInputSchema } from "../actions/request-upload.contract.js";
import { catalogObjectKey } from "./object-key.js";
import { getFilesObjectStore } from "./s3-port.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type RequestInput = z.output<typeof requestUploadInputSchema>;

export async function requestStaffUpload(input: {
  readonly ctx: StaffCtx;
  readonly input: RequestInput;
}): Promise<{
  readonly fileId: string;
  readonly uploadUrl: string;
  readonly expiresAt: string;
}> {
  const db = requireWritable(input.ctx.db);
  const fileId = randomUUID();
  const objectKey = catalogObjectKey(input.ctx.companyId, fileId);
  const store = getFilesObjectStore();

  await db.insert(files).values({
    id: fileId,
    companyId: input.ctx.companyId,
    uploadedByUserId: input.ctx.userId,
    purpose: input.input.purpose,
    objectKey,
    mimeType: input.input.mimeType,
    byteSize: BigInt(input.input.byteSize),
    checksumSha256: input.input.checksumSha256,
    status: "pending",
  });

  const signed = await store.signPut({
    key: objectKey,
    mimeType: input.input.mimeType,
    byteSize: input.input.byteSize,
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

  if (signed.url.length === 0) {
    throw new CoreInvariantError(
      "files object store returned an empty PUT URL",
    );
  }

  return {
    fileId,
    uploadUrl: signed.url,
    expiresAt: signed.expiresAt.toISOString(),
  };
}
