/**
 * Page token may still be valid when the stored S3 signature is missing or
 * past the download expiry. Staff remints via `documents.share`.
 */
export function storedShareDownloadUrl(
  downloadUrl: string | null,
  downloadExpiresAt: Date | null,
  now: Date,
): string | null {
  if (downloadUrl === null || downloadExpiresAt === null) {
    return null;
  }
  if (downloadExpiresAt.getTime() <= now.getTime()) {
    return null;
  }
  return downloadUrl;
}

/**
 * Page token may still be valid when the stored S3 signature is missing or
 * past `pdf_download_expires_at`. Staff remints via `documents.share`.
 */
export function storedSharePdfDownloadUrl(
  pdfDownloadUrl: string | null,
  pdfDownloadExpiresAt: Date | null,
  now: Date,
): string | null {
  return storedShareDownloadUrl(pdfDownloadUrl, pdfDownloadExpiresAt, now);
}
