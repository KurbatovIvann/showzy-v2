/**
 * Catalog image attach ceilings. The replace cap is
 * `@showzy/validation/catalog` (SHO-156 / SHO-158). MIME/purpose/size
 * match `files.requestUpload` (`wire.contract.ts`).
 */
export { SET_PRODUCT_IMAGES_MAX } from "@showzy/validation/catalog";

/** Files handshake purpose — catalog uploads only. */
export const FILE_PURPOSE = "catalog" as const;

export const FILE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type CatalogImageMime = (typeof FILE_MIME_TYPES)[number];

/** 10 MiB — `files.requestUpload` / security-operations.md §3. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const PHOTO_MAX_EDGE = 2048;
export const PHOTO_MIN_EDGE = 720;
export const PHOTO_START_COMPRESS = 0.82;
export const PHOTO_MIN_COMPRESS = 0.4;
