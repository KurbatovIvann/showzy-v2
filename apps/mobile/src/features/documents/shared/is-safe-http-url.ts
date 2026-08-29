/**
 * Panel PDF and public `pdfDownloadUrl` must be http(s) before
 * `Linking.openURL`. Shared by form print, list options, and `/d/[token]`.
 */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
