/**
 * SHA-256 digest → lowercase hex. The digest is computed by `expo-crypto`
 * on device; this helper stays unit-testable and never logs the value.
 */
export function sha256DigestToHex(hashed: ArrayBuffer): string {
  const bytes = new Uint8Array(hashed);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}
