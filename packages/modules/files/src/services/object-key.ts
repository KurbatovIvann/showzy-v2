import type { CatalogRendition } from "../wire.contract.js";

/** Durable catalog object key stored in `files.object_key` (CHECK-preserving). */
export function catalogObjectKey(companyId: string, fileId: string): string {
  return `${companyId}/catalog/${fileId}`;
}

/**
 * Derived catalog WebP key. Never stored in `files.object_key` — the original
 * CHECK stays `{companyId}/catalog/{fileId}`. `full` is the 2048 derivative,
 * not the original catalog object (SHO-246).
 */
export function catalogRenditionObjectKey(
  companyId: string,
  fileId: string,
  rendition: CatalogRendition,
): string {
  return `${companyId}/catalog/${fileId}/${rendition}`;
}

/**
 * Durable generated-document object key stored in `files.object_key`
 * (CHECK-preserving). Server-derived; never client-supplied.
 */
export function documentObjectKey(companyId: string, fileId: string): string {
  return `${companyId}/documents/${fileId}`;
}

/**
 * Durable ASiC-E object key stored in `files.object_key` (CHECK-preserving).
 * Server-derived; never client-supplied. Handshake PUT still uses
 * `stagingObjectKey` and is never stored.
 */
export function signingObjectKey(companyId: string, fileId: string): string {
  return `${companyId}/signing/${fileId}`;
}

/**
 * Handshake PUT key. Derived in code, never stored in `object_key` — a leftover
 * signed PUT after finalize can overwrite staging only (SHO-113).
 */
export function stagingObjectKey(companyId: string, fileId: string): string {
  return `${companyId}/uploads/${fileId}`;
}
