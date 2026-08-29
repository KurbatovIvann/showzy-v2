/**
 * Page token may still be valid when the stored S3 signature is missing or
 * past `pdf_download_expires_at`. Staff remints via `documents.share`.
 */
export function storedSharePdfDownloadUrl(
  pdfDownloadUrl: string | null,
  pdfDownloadExpiresAt: Date | null,
  now: Date,
): string | null {
  if (pdfDownloadUrl === null || pdfDownloadExpiresAt === null) {
    return null;
  }
  if (pdfDownloadExpiresAt.getTime() <= now.getTime()) {
    return null;
  }
  return pdfDownloadUrl;
}
