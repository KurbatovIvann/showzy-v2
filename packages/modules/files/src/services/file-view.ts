import { CoreInvariantError } from "@showzy/core/errors";
import type { z } from "zod";

import {
  documentMimeTypeSchema,
  documentPurposeSchema,
  fileMimeTypeSchema,
  filePurposeSchema,
  signingMimeTypeSchema,
  signingPurposeSchema,
  type DocumentMimeType,
  type FileMimeType,
  type SigningMimeType,
} from "../wire.contract.js";
import {
  documentReadyViewSchema,
  fileReadyViewSchema,
  signingReadyViewSchema,
} from "../actions/file-view.contract.js";

export type FileReadyView = z.output<typeof fileReadyViewSchema>;
export type DocumentReadyView = z.output<typeof documentReadyViewSchema>;
export type SigningReadyView = z.output<typeof signingReadyViewSchema>;

export interface FileRow {
  readonly id: string;
  readonly purpose: string;
  readonly mimeType: string;
  readonly byteSize: bigint;
  readonly checksumSha256: string | null;
  readonly status: string;
}

export function toReadyView(row: FileRow): FileReadyView {
  if (row.status !== "ready") {
    throw new CoreInvariantError("files ready view requires status ready");
  }
  if (row.checksumSha256 === null) {
    throw new CoreInvariantError("files ready view requires a checksum");
  }
  const purpose = filePurposeSchema.safeParse(row.purpose);
  const mimeType = fileMimeTypeSchema.safeParse(row.mimeType);
  if (!purpose.success || !mimeType.success) {
    throw new CoreInvariantError(
      "files ready row has an illegal purpose or MIME",
    );
  }
  const byteSize = Number(row.byteSize);
  if (!Number.isSafeInteger(byteSize) || byteSize < 1) {
    throw new CoreInvariantError("files ready row has a non-positive size");
  }
  return {
    fileId: row.id,
    status: "ready",
    purpose: purpose.data,
    mimeType: mimeType.data,
    byteSize,
    checksumSha256: row.checksumSha256,
  };
}

export function requireDeclaredMime(value: string): FileMimeType {
  const parsed = fileMimeTypeSchema.safeParse(value);
  if (!parsed.success) {
    throw new CoreInvariantError("files row has an undeclared MIME type");
  }
  return parsed.data;
}

export function requireDocumentMime(value: string): DocumentMimeType {
  const parsed = documentMimeTypeSchema.safeParse(value);
  if (!parsed.success) {
    throw new CoreInvariantError("files document row has an undeclared MIME");
  }
  return parsed.data;
}

export function toDocumentReadyView(row: FileRow): DocumentReadyView {
  if (row.status !== "ready") {
    throw new CoreInvariantError("files document view requires status ready");
  }
  if (row.checksumSha256 === null) {
    throw new CoreInvariantError("files document view requires a checksum");
  }
  const purpose = documentPurposeSchema.safeParse(row.purpose);
  const mimeType = documentMimeTypeSchema.safeParse(row.mimeType);
  if (!purpose.success || !mimeType.success) {
    throw new CoreInvariantError(
      "files document row has an illegal purpose or MIME",
    );
  }
  const byteSize = Number(row.byteSize);
  if (!Number.isSafeInteger(byteSize) || byteSize < 1) {
    throw new CoreInvariantError("files document row has a non-positive size");
  }
  return {
    fileId: row.id,
    status: "ready",
    purpose: purpose.data,
    mimeType: mimeType.data,
    byteSize,
    checksumSha256: row.checksumSha256,
  };
}

export function requireSigningMime(value: string): SigningMimeType {
  const parsed = signingMimeTypeSchema.safeParse(value);
  if (!parsed.success) {
    throw new CoreInvariantError("files signing row has an undeclared MIME");
  }
  return parsed.data;
}

export function toSigningReadyView(row: FileRow): SigningReadyView {
  if (row.status !== "ready") {
    throw new CoreInvariantError("files signing view requires status ready");
  }
  if (row.checksumSha256 === null) {
    throw new CoreInvariantError("files signing view requires a checksum");
  }
  const purpose = signingPurposeSchema.safeParse(row.purpose);
  const mimeType = signingMimeTypeSchema.safeParse(row.mimeType);
  if (!purpose.success || !mimeType.success) {
    throw new CoreInvariantError(
      "files signing row has an illegal purpose or MIME",
    );
  }
  const byteSize = Number(row.byteSize);
  if (!Number.isSafeInteger(byteSize) || byteSize < 1) {
    throw new CoreInvariantError("files signing row has a non-positive size");
  }
  return {
    fileId: row.id,
    status: "ready",
    purpose: purpose.data,
    mimeType: mimeType.data,
    byteSize,
    checksumSha256: row.checksumSha256,
  };
}
