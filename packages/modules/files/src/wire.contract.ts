/**
 * Client-safe file upload primitives shared by the T2 actions. Mechanical
 * ceilings the feature card named: catalog purpose only, 10 MiB, JPEG/PNG/WEBP.
 *
 * Generated-document ceilings (SHO-229 / security-operations.md §3): PDF
 * purpose, 25 MiB. Catalog handshake schemas stay catalog-only.
 *
 * Signing ceilings (SHO-253 / SHO-251): ASiC-E purpose, same 25 MiB
 * document class. Signing handshake schemas stay signing-only.
 */
import { z } from "zod";

export const FILE_PURPOSE = "catalog" as const;

export const DOCUMENT_PURPOSE = "document" as const;

export const SIGNING_PURPOSE = "signing" as const;

export const FILE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/**
 * Named catalog derivations (SHO-244 / SHO-246). Not stored in
 * `files.object_key`. `full` is the 2048 WebP, not the original.
 */
export const CATALOG_RENDITIONS = ["thumb", "card", "hero", "full"] as const;

export type CatalogRendition = (typeof CATALOG_RENDITIONS)[number];

export const DOCUMENT_MIME_TYPE = "application/pdf" as const;

export const SIGNING_MIME_TYPE = "application/vnd.etsi.asic-e+zip" as const;

export type FileMimeType = (typeof FILE_MIME_TYPES)[number];

export type DocumentMimeType = typeof DOCUMENT_MIME_TYPE;

export type SigningMimeType = typeof SIGNING_MIME_TYPE;

export type HandshakePutMimeType = FileMimeType | SigningMimeType;

export type StoredObjectMimeType =
  FileMimeType | DocumentMimeType | SigningMimeType;

/** 10 MiB — foundation default for images (security-operations.md §3). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** 25 MiB — foundation default for PDF/document files (security-operations.md §3). */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export const filePurposeSchema = z.literal(FILE_PURPOSE);

export const documentPurposeSchema = z.literal(DOCUMENT_PURPOSE);

export const signingPurposeSchema = z.literal(SIGNING_PURPOSE);

export const fileMimeTypeSchema = z.enum(FILE_MIME_TYPES);

export const catalogRenditionSchema = z.enum(CATALOG_RENDITIONS);

export const documentMimeTypeSchema = z.literal(DOCUMENT_MIME_TYPE);

export const signingMimeTypeSchema = z.literal(SIGNING_MIME_TYPE);

export const checksumSha256Schema = z
  .string()
  .regex(
    /^[0-9a-f]{64}$/,
    "Expected a 64-character lowercase hex SHA-256 checksum",
  );

export const uploadByteSizeSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_UPLOAD_BYTES);

export const documentByteSizeSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_DOCUMENT_BYTES);
