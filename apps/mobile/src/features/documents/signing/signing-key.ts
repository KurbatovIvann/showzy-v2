/**
 * On-device key picker accept list (SHO-260). Canvas: Key-6.dat / .pfx /
 * .p12 / .pk8 / .jks. The key never leaves the device; this module only
 * classifies the file name.
 */
const ALLOWED_EXTENSIONS = [".dat", ".pfx", ".p12", ".pk8", ".jks"] as const;

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
  return ALLOWED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}
