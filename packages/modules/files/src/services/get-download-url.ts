import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { files } from "@showzy/db/schema/files";
import { and, eq, inArray } from "drizzle-orm";
import type { z } from "zod";

import type { getDownloadUrlInputSchema } from "../actions/get-download-url.contract.js";
import type { getDownloadUrlsInputSchema } from "../actions/get-download-urls.contract.js";
import { requireDeclaredMime } from "./file-view.js";
import { catalogObjectKey } from "./object-key.js";
import { getFilesObjectStore } from "./s3-port.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type DownloadInput = z.output<typeof getDownloadUrlInputSchema>;
type DownloadUrlsInput = z.output<typeof getDownloadUrlsInputSchema>;

type SignedDownload = {
  readonly fileId: string;
  readonly downloadUrl: string;
  readonly expiresAt: string;
};

type ReadyFileRow = {
  readonly id: string;
  readonly objectKey: string;
  readonly mimeType: string;
};

function uniqueFileIds(fileIds: readonly string[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const fileId of fileIds) {
    if (seen.has(fileId)) {
      continue;
    }
    seen.add(fileId);
    ids.push(fileId);
  }
  return ids;
}

async function signReadyCatalogGet(row: ReadyFileRow): Promise<SignedDownload> {
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

function requireCatalogObjectKey(
  companyId: string,
  row: ReadyFileRow,
): ReadyFileRow {
  if (row.objectKey !== catalogObjectKey(companyId, row.id)) {
    throw new NotFoundError();
  }
  return row;
}

export async function getStaffDownloadUrl(input: {
  readonly ctx: StaffCtx;
  readonly input: DownloadInput;
}): Promise<SignedDownload> {
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

  return signReadyCatalogGet(requireCatalogObjectKey(input.ctx.companyId, row));
}

export async function getStaffDownloadUrls(input: {
  readonly ctx: StaffCtx;
  readonly input: DownloadUrlsInput;
}): Promise<{ files: SignedDownload[] }> {
  const fileIds = uniqueFileIds(input.input.fileIds);
  const rows = await input.ctx.db
    .select()
    .from(files)
    .where(
      and(
        eq(files.companyId, input.ctx.companyId),
        eq(files.status, "ready"),
        inArray(files.id, fileIds),
      ),
    );

  if (rows.length !== fileIds.length) {
    throw new NotFoundError();
  }

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const ordered: ReadyFileRow[] = [];
  for (const fileId of fileIds) {
    const row = rowById.get(fileId);
    if (row === undefined) {
      throw new CoreInvariantError(
        "file row missing after the existence check",
      );
    }
    ordered.push(requireCatalogObjectKey(input.ctx.companyId, row));
  }

  const signed: SignedDownload[] = [];
  for (const row of ordered) {
    signed.push(await signReadyCatalogGet(row));
  }
  return { files: signed };
}
