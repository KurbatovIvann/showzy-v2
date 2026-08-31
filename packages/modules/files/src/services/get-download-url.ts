import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { files } from "@showzy/db/schema/files";
import { uniqueIds } from "@showzy/module-kit/unique-ids";
import { and, eq, inArray } from "drizzle-orm";
import type { z } from "zod";

import type { getDownloadUrlInputSchema } from "../actions/get-download-url.contract.js";
import type { getDownloadUrlsInputSchema } from "../actions/get-download-urls.contract.js";
import type { issueDocumentDownloadUrlInputSchema } from "../actions/issue-document-download-url.contract.js";
import type { issueSigningDownloadUrlInputSchema } from "../actions/issue-signing-download-url.contract.js";
import type {
  CatalogRendition,
  StoredObjectMimeType,
} from "../wire.contract.js";
import {
  catalogFilePurpose,
  documentFilePurpose,
  requirePurposeObjectKey,
  signingFilePurpose,
} from "./file-purpose.js";
import { toDocumentReadyView } from "./file-view.js";
import { catalogRenditionObjectKey } from "./object-key.js";
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

async function signReadyCatalogGet(
  companyId: string,
  row: ReadyFileRow,
  rendition: CatalogRendition | undefined,
): Promise<SignedDownload> {
  if (rendition === undefined) {
    return signStoredGet(
      row.id,
      row.objectKey,
      catalogFilePurpose.requireMime(row.mimeType),
    );
  }

  const key = catalogRenditionObjectKey(companyId, row.id, rendition);
  const head = await getFilesObjectStore().headObject(key);
  if (head === "missing") {
    throw new NotFoundError();
  }
  return signStoredGet(row.id, key, "image/webp");
}

async function signStoredGet(
  fileId: string,
  key: string,
  mimeType: StoredObjectMimeType,
): Promise<SignedDownload> {
  const signed = await getFilesObjectStore().signGet({
    key,
    mimeType,
  });
  if (signed.url.length === 0) {
    throw new CoreInvariantError(
      "files object store returned an empty GET URL",
    );
  }

  return {
    fileId,
    downloadUrl: signed.url,
    expiresAt: signed.expiresAt.toISOString(),
  };
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
        eq(files.purpose, catalogFilePurpose.purpose),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (row === undefined) {
    throw new NotFoundError();
  }

  return signReadyCatalogGet(
    input.ctx.companyId,
    requirePurposeObjectKey(input.ctx.companyId, row, catalogFilePurpose),
    input.input.rendition,
  );
}

export async function getStaffDownloadUrls(input: {
  readonly ctx: StaffCtx;
  readonly input: DownloadUrlsInput;
}): Promise<{ files: SignedDownload[] }> {
  const fileIds = uniqueIds(input.input.fileIds);
  const rows = await input.ctx.db
    .select()
    .from(files)
    .where(
      and(
        eq(files.companyId, input.ctx.companyId),
        eq(files.status, "ready"),
        eq(files.purpose, catalogFilePurpose.purpose),
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
    ordered.push(
      requirePurposeObjectKey(input.ctx.companyId, row, catalogFilePurpose),
    );
  }

  const signed = await Promise.all(
    ordered.map((row) =>
      signReadyCatalogGet(input.ctx.companyId, row, input.input.rendition),
    ),
  );
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
        eq(files.purpose, documentFilePurpose.purpose),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (row === undefined) {
    throw new NotFoundError();
  }

  const checksumSha256 = toDocumentReadyView(row).checksumSha256;
  const keyed = requirePurposeObjectKey(
    input.ctx.companyId,
    row,
    documentFilePurpose,
  );
  const signed = await signStoredGet(
    keyed.id,
    keyed.objectKey,
    documentFilePurpose.requireMime(keyed.mimeType),
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
        eq(files.purpose, signingFilePurpose.purpose),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (row === undefined) {
    throw new NotFoundError();
  }

  const keyed = requirePurposeObjectKey(
    input.companyId,
    row,
    signingFilePurpose,
  );
  return signStoredGet(
    keyed.id,
    keyed.objectKey,
    signingFilePurpose.requireMime(keyed.mimeType),
  );
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
