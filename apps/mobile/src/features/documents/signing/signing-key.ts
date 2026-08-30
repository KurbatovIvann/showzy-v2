/**
 * On-device key picker accept list (SHO-260). Canvas: Key-6.dat / .pfx /
 * .p12 / .pk8 / .jks. The key never leaves the device; this module only
 * classifies the file name and wipes key bytes.
 */
const ALLOWED_EXTENSIONS = [".pfx", ".p12", ".pk8", ".jks"] as const;
const KEY6_DAT = /key-6\.dat$/i;

export function signingKeyFileName(
  name: string | null | undefined,
): string | null {
  if (name === undefined || name === null) {
    return null;
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const slash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

export function isAllowedSigningKeyName(name: string): boolean {
  const fileName = signingKeyFileName(name);
  if (fileName === null) {
    return false;
  }
  const lower = fileName.toLowerCase();
  if (KEY6_DAT.test(lower)) {
    return true;
  }
  return ALLOWED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export function wipeKeyBytes(bytes: Uint8Array | null): void {
  if (bytes !== null) {
    bytes.fill(0);
  }
}
