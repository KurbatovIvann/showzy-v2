import { CoreInvariantError } from "@showzy/core/errors";
import type { z } from "zod";

import {
  fileMimeTypeSchema,
  filePurposeSchema,
  type FileMimeType,
} from "../wire.contract.js";
import { fileReadyViewSchema } from "../actions/file-view.contract.js";

export type FileReadyView = z.output<typeof fileReadyViewSchema>;

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
