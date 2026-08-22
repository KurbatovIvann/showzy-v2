import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { files } from "@showzy/db/schema/files";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import type { getDownloadUrlInputSchema } from "../actions/get-download-url.contract.js";
import { requireDeclaredMime } from "./file-view.js";
import { catalogObjectKey } from "./object-key.js";
import { getFilesObjectStore } from "./s3-port.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type DownloadInput = z.output<typeof getDownloadUrlInputSchema>;

export async function getStaffDownloadUrl(input: {
  readonly ctx: StaffCtx;
  readonly input: DownloadInput;
}): Promise<{
  readonly fileId: string;
  readonly downloadUrl: string;
  readonly expiresAt: string;
}> {
  const rows = await input.ctx.db
    .select()
    .from(files)
    .where(
      and(
        eq(files.companyId, input.ctx.companyId),
        eq(files.id, input.input.fileId),
        eq(files.status, "ready"),
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
  const signed = await getFilesObjectStore().signGet({
    key: row.objectKey,
    mimeType,
  });
  if (signed.url.length === 0) {
    throw new CoreInvariantError(
      "files object store returned an empty GET URL",
    );
  }

  return {
    fileId: row.id,
    downloadUrl: signed.url,
    expiresAt: signed.expiresAt.toISOString(),
  };
}
