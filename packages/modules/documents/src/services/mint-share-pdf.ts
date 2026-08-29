import { NotFoundError } from "@showzy/core/errors";

/**
 * Pre-mint the short-lived PDF GET. Missing artifacts and issuer not-found
 * become stored nulls so `documents.share` does not fail (SHO-236 fills
 * generation). Other issuer errors propagate.
 */
export async function mintSharePdfDownload(env: {
  readonly fileId: string | null;
  readonly issueShareDownload: (fileId: string) => Promise<{
    readonly downloadUrl: string;
    readonly expiresAt: string;
  }>;
}): Promise<{
  readonly pdfDownloadUrl: string | null;
  readonly pdfDownloadExpiresAt: Date | null;
}> {
  if (env.fileId === null) {
    return { pdfDownloadUrl: null, pdfDownloadExpiresAt: null };
  }
  try {
    const minted = await env.issueShareDownload(env.fileId);
    return {
      pdfDownloadUrl: minted.downloadUrl,
      pdfDownloadExpiresAt: new Date(minted.expiresAt),
    };
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { pdfDownloadUrl: null, pdfDownloadExpiresAt: null };
    }
    throw error;
  }
}
