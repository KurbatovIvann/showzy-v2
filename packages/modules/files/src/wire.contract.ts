/**
 * Client-safe file upload primitives shared by the T2 actions. Mechanical
 * ceilings the feature card named: catalog purpose only, 10 MiB, JPEG/PNG/WEBP.
 */
import { z } from "zod";

export const FILE_PURPOSE = "catalog" as const;

export const FILE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type FileMimeType = (typeof FILE_MIME_TYPES)[number];

/** 10 MiB — foundation default for images (security-operations.md §3). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const filePurposeSchema = z.literal(FILE_PURPOSE);

export const fileMimeTypeSchema = z.enum(FILE_MIME_TYPES);

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
