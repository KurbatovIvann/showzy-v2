/** Durable catalog object key stored in `files.object_key` (CHECK-preserving). */
export function catalogObjectKey(companyId: string, fileId: string): string {
  return `${companyId}/catalog/${fileId}`;
}

/**
 * Durable generated-document object key stored in `files.object_key`
 * (CHECK-preserving). Server-derived; never client-supplied.
 */
export function documentObjectKey(companyId: string, fileId: string): string {
  return `${companyId}/documents/${fileId}`;
}

/**
 * Handshake PUT key. Derived in code, never stored in `object_key` — a leftover
 * signed PUT after finalize can overwrite staging only (SHO-113).
 */
export function stagingObjectKey(companyId: string, fileId: string): string {
  return `${companyId}/uploads/${fileId}`;
}
