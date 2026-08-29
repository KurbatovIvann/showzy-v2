import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import { CoreInvariantError } from "@showzy/core/errors";

/**
 * DNS namespace UUID (RFC 4122 Appendix C). Name is
 * `showzy.doc-generation.artifact:{documentId}` so a retry of the same
 * document PUTs the same `{companyId}/documents/{fileId}` key. The jobs
 * FK cannot store `file_id` until the files row exists (MATCH SIMPLE).
 */
const DNS_NAMESPACE_UUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

function uuidBytes(uuid: string): Uint8Array {
  const hex = uuid.replaceAll("-", "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    const slice = hex.slice(i * 2, i * 2 + 2);
    bytes[i] = Number.parseInt(slice, 16);
  }
  return bytes;
}

function formatUuid(bytes: Uint8Array): string {
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** RFC 4122 UUID v5 so the same document always records the same file id. */
export function artifactFileId(documentId: string): string {
  const hash = createHash("sha1")
    .update(uuidBytes(DNS_NAMESPACE_UUID))
    .update(`showzy.doc-generation.artifact:${documentId}`)
    .digest();
  const bytes = Uint8Array.from(hash.subarray(0, 16));
  const versionByte = bytes[6];
  const variantByte = bytes[8];
  if (versionByte === undefined || variantByte === undefined) {
    throw new CoreInvariantError("SHA-1 digest shorter than 16 bytes");
  }
  bytes[6] = (versionByte & 0x0f) | 0x50;
  bytes[8] = (variantByte & 0x3f) | 0x80;
  return formatUuid(bytes);
}
