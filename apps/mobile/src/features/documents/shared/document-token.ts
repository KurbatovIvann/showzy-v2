/**
 * Page-token selector for `/d/[token]` (SHO-238). Tokens are
 * `randomBytes(32).toString("base64url")`, not UUIDs — do not reuse
 * `uuidFromParam`. Do not log the raw token.
 */
const SHARE_TOKEN_MAX = 128;

export function shareTokenFromParam(
  value: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) {
    return null;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw).trim();
  } catch {
    return null;
  }
  if (decoded.length < 1 || decoded.length > SHARE_TOKEN_MAX) {
    return null;
  }
  if (decoded.includes("/") || decoded.includes("..")) {
    return null;
  }
  return decoded;
}
