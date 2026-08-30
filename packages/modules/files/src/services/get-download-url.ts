import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { files } from "@showzy/db/schema/files";
import { and, eq, inArray } from "drizzle-orm";
import type { z } from "zod";

import type { getDownloadUrlInputSchema } from "../actions/get-download-url.contract.js";
import type { getDownloadUrlsInputSchema } from "../actions/get-download-urls.contract.js";
import type { issueDocumentDownloadUrlInputSchema } from "../actions/issue-document-download-url.contract.js";
import type { issueSigningDownloadUrlInputSchema } from "../actions/issue-signing-download-url.contract.js";
import {
  requireDeclaredMime,
  requireDocumentMime,
  requireSigningMime,
  toDocumentReadyView,
} from "./file-view.js";
import {
  catalogObjectKey,
  documentObjectKey,
  signingObjectKey,
} from "./object-key.js";
import { getFilesObjectStore } from "./s3-port.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type SystemTenantCtx = Extract<
  ActionCtx,
  { principal: "system"; scope: "tenant" }
>;
type DownloadInput = z.output<typeof getDownloadUrlInputSchema>;
type DownloadUrlsInput = z.output<typeof getDownloadUrlsInputSchema>;
type DocumentDownloadInput = z.output<
  typeof issueDocumentDownloadUrlInputSchema
>;
type SigningDownloadInput = z.output<typeof issueSigningDownloadUrlInputSchema>;

type SignedDownload = {
  readonly fileId: string;
  readonly downloadUrl: string;
  readonly expiresAt: string;
};

type DocumentSignedDownload = SignedDownload & {
  readonly checksumSha256: string;
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

async function signReadyDocumentGet(
  row: ReadyFileRow,
): Promise<SignedDownload> {
  const mimeType = requireDocumentMime(row.mimeType);
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

function requireDocumentObjectKey(
  companyId: string,
  row: ReadyFileRow,
): ReadyFileRow {
  if (row.objectKey !== documentObjectKey(companyId, row.id)) {
    throw new NotFoundError();
  }
  return row;
}

async function signReadySigningGet(row: ReadyFileRow): Promise<SignedDownload> {
  const mimeType = requireSigningMime(row.mimeType);
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

function requireSigningObjectKey(
  companyId: string,
  row: ReadyFileRow,
): ReadyFileRow {
  if (row.objectKey !== signingObjectKey(companyId, row.id)) {
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
        eq(files.purpose, "catalog"),
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
        eq(files.purpose, "catalog"),
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

export async function getStaffDocumentDownloadUrl(input: {
  readonly ctx: StaffCtx;
  readonly input: DocumentDownloadInput;
}): Promise<DocumentSignedDownload> {
  const rows = await input.ctx.db
    .select()
    .from(files)
    .where(
      and(
        eq(files.companyId, input.ctx.companyId),
        eq(files.id, input.input.fileId),
        eq(files.status, "ready"),
        eq(files.purpose, "document"),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (row === undefined) {
    throw new NotFoundError();
  }

  const checksumSha256 = toDocumentReadyView(row).checksumSha256;
  const signed = await signReadyDocumentGet(
    requireDocumentObjectKey(input.ctx.companyId, row),
  );
  return { ...signed, checksumSha256 };
}

async function getReadySigningDownloadUrl(input: {
  readonly db: StaffCtx["db"];
  readonly companyId: string;
  readonly fileId: string;
}): Promise<SignedDownload> {
  const rows = await input.db
    .select()
    .from(files)
    .where(
      and(
        eq(files.companyId, input.companyId),
        eq(files.id, input.fileId),
        eq(files.status, "ready"),
        eq(files.purpose, "signing"),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (row === undefined) {
    throw new NotFoundError();
  }

  return signReadySigningGet(requireSigningObjectKey(input.companyId, row));
}

export async function getStaffSigningDownloadUrl(input: {
  readonly ctx: StaffCtx;
  readonly input: SigningDownloadInput;
}): Promise<SignedDownload> {
  return getReadySigningDownloadUrl({
    db: input.ctx.db,
    companyId: input.ctx.companyId,
    fileId: input.input.fileId,
  });
}

export async function getSystemSigningDownloadUrl(input: {
  readonly ctx: SystemTenantCtx;
  readonly input: SigningDownloadInput;
}): Promise<SignedDownload> {
  return getReadySigningDownloadUrl({
    db: input.ctx.db,
    companyId: input.ctx.companyId,
    fileId: input.input.fileId,
  });
}
