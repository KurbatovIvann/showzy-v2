/**
 * SHA-256 digest → lowercase hex. The digest itself is computed by
 * `expo-crypto` on device; this helper stays unit-testable and never
 * logs the value (ticket: never log checksums or URLs).
 */

export function sha256DigestToHex(digest: ArrayBuffer): string {
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}
