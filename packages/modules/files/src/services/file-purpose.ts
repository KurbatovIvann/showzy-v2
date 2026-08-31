import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import type { z } from "zod";

import {
  documentReadyViewSchema,
  fileReadyViewSchema,
  signingReadyViewSchema,
} from "../actions/file-view.contract.js";
import {
  DOCUMENT_PURPOSE,
  FILE_PURPOSE,
  SIGNING_PURPOSE,
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
  catalogObjectKey,
  documentObjectKey,
  signingObjectKey,
} from "./object-key.js";

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

export type PurposeReadyView<TPurpose extends string, TMime extends string> = {
  readonly fileId: string;
  readonly status: "ready";
  readonly purpose: TPurpose;
  readonly mimeType: TMime;
  readonly byteSize: number;
  readonly checksumSha256: string;
};

export interface FilePurposeDescriptor<
  TPurpose extends string,
  TMime extends string,
> {
  readonly purpose: TPurpose;
  readonly mimeSchema: z.ZodType<TMime>;
  readonly viewSchema:
    | typeof fileReadyViewSchema
    | typeof documentReadyViewSchema
    | typeof signingReadyViewSchema;
  readonly objectKey: (companyId: string, fileId: string) => string;
  readonly pendingSizeInvariant?: string;
  requireMime(value: string): TMime;
  toReadyView(row: FileRow): PurposeReadyView<TPurpose, TMime>;
}

export type HandshakeFilePurpose<
  TPurpose extends "catalog" | "signing",
  TMime extends string,
> = FilePurposeDescriptor<TPurpose, TMime> & {
  readonly pendingSizeInvariant: string;
};

function defineFilePurpose<
  TPurpose extends string,
  TMime extends string,
>(spec: {
  readonly purpose: TPurpose;
  readonly purposeSchema: z.ZodType<TPurpose>;
  readonly mimeSchema: z.ZodType<TMime>;
  readonly viewSchema:
    | typeof fileReadyViewSchema
    | typeof documentReadyViewSchema
    | typeof signingReadyViewSchema;
  readonly objectKey: (companyId: string, fileId: string) => string;
  readonly viewLabel: string;
  readonly mimeInvariant: string;
  readonly pendingSizeInvariant?: string;
}): FilePurposeDescriptor<TPurpose, TMime> {
  const descriptor: FilePurposeDescriptor<TPurpose, TMime> = {
    purpose: spec.purpose,
    mimeSchema: spec.mimeSchema,
    viewSchema: spec.viewSchema,
    objectKey: spec.objectKey,
    requireMime(value) {
      const parsed = spec.mimeSchema.safeParse(value);
      if (!parsed.success) {
        throw new CoreInvariantError(spec.mimeInvariant);
      }
      return parsed.data;
    },
    toReadyView(row) {
      return toPurposeReadyView(row, spec);
    },
  };
  if (spec.pendingSizeInvariant === undefined) {
    return descriptor;
  }
  return {
    ...descriptor,
    pendingSizeInvariant: spec.pendingSizeInvariant,
  };
}

function defineHandshakePurpose<
  TPurpose extends "catalog" | "signing",
  TMime extends string,
>(spec: {
  readonly purpose: TPurpose;
  readonly purposeSchema: z.ZodType<TPurpose>;
  readonly mimeSchema: z.ZodType<TMime>;
  readonly viewSchema:
    | typeof fileReadyViewSchema
    | typeof documentReadyViewSchema
    | typeof signingReadyViewSchema;
  readonly objectKey: (companyId: string, fileId: string) => string;
  readonly viewLabel: string;
  readonly mimeInvariant: string;
  readonly pendingSizeInvariant: string;
}): HandshakeFilePurpose<TPurpose, TMime> {
  return {
    purpose: spec.purpose,
    mimeSchema: spec.mimeSchema,
    viewSchema: spec.viewSchema,
    objectKey: spec.objectKey,
    pendingSizeInvariant: spec.pendingSizeInvariant,
    requireMime(value) {
      const parsed = spec.mimeSchema.safeParse(value);
      if (!parsed.success) {
        throw new CoreInvariantError(spec.mimeInvariant);
      }
      return parsed.data;
    },
    toReadyView(row) {
      return toPurposeReadyView(row, spec);
    },
  };
}

function toPurposeReadyView<TPurpose extends string, TMime extends string>(
  row: FileRow,
  spec: {
    readonly purposeSchema: z.ZodType<TPurpose>;
    readonly mimeSchema: z.ZodType<TMime>;
    readonly viewLabel: string;
  },
): PurposeReadyView<TPurpose, TMime> {
  if (row.status !== "ready") {
    throw new CoreInvariantError(
      `${spec.viewLabel} view requires status ready`,
    );
  }
  if (row.checksumSha256 === null) {
    throw new CoreInvariantError(`${spec.viewLabel} view requires a checksum`);
  }
  const purpose = spec.purposeSchema.safeParse(row.purpose);
  const mimeType = spec.mimeSchema.safeParse(row.mimeType);
  if (!purpose.success || !mimeType.success) {
    throw new CoreInvariantError(
      `${spec.viewLabel} row has an illegal purpose or MIME`,
    );
  }
  const byteSize = Number(row.byteSize);
  if (!Number.isSafeInteger(byteSize) || byteSize < 1) {
    throw new CoreInvariantError(
      `${spec.viewLabel} row has a non-positive size`,
    );
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

export function requirePurposeObjectKey<
  T extends { readonly id: string; readonly objectKey: string },
>(
  companyId: string,
  row: T,
  purpose: {
    readonly objectKey: (companyId: string, fileId: string) => string;
  },
): T {
  if (row.objectKey !== purpose.objectKey(companyId, row.id)) {
    throw new NotFoundError();
  }
  return row;
}

/**
 * Per-purpose ready-file pipeline. Catalog WebP renditions stay a catalog
 * overlay in get-download-url — not a fourth purpose.
 */
export const catalogFilePurpose: HandshakeFilePurpose<
  typeof FILE_PURPOSE,
  FileMimeType
> = defineHandshakePurpose({
  purpose: FILE_PURPOSE,
  purposeSchema: filePurposeSchema,
  mimeSchema: fileMimeTypeSchema,
  viewSchema: fileReadyViewSchema,
  objectKey: catalogObjectKey,
  viewLabel: "files ready",
  mimeInvariant: "files row has an undeclared MIME type",
  pendingSizeInvariant: "files pending row has a non-positive declared size",
});

export const documentFilePurpose: FilePurposeDescriptor<
  typeof DOCUMENT_PURPOSE,
  DocumentMimeType
> = defineFilePurpose({
  purpose: DOCUMENT_PURPOSE,
  purposeSchema: documentPurposeSchema,
  mimeSchema: documentMimeTypeSchema,
  viewSchema: documentReadyViewSchema,
  objectKey: documentObjectKey,
  viewLabel: "files document",
  mimeInvariant: "files document row has an undeclared MIME",
});

export const signingFilePurpose: HandshakeFilePurpose<
  typeof SIGNING_PURPOSE,
  SigningMimeType
> = defineHandshakePurpose({
  purpose: SIGNING_PURPOSE,
  purposeSchema: signingPurposeSchema,
  mimeSchema: signingMimeTypeSchema,
  viewSchema: signingReadyViewSchema,
  objectKey: signingObjectKey,
  viewLabel: "files signing",
  mimeInvariant: "files signing row has an undeclared MIME",
  pendingSizeInvariant:
    "files pending signing row has a non-positive declared size",
});

export const FILE_PURPOSE_PIPELINE = {
  catalog: catalogFilePurpose,
  document: documentFilePurpose,
  signing: signingFilePurpose,
} as const;
