import { NotFoundError } from "@showzy/core/errors";

export type MintedShareDownload = {
  readonly downloadUrl: string | null;
  readonly downloadExpiresAt: Date | null;
};

/**
 * Pre-mint a short-lived GET. Missing artifacts and issuer not-found
 * become stored nulls so `documents.share` does not fail (SHO-236 fills
 * generation; SHO-259 fills a recorded ASiC). Other issuer errors propagate.
 */
export async function mintShareDownload(env: {
  readonly fileId: string | null;
  readonly issueShareDownload: (fileId: string) => Promise<{
    readonly downloadUrl: string;
    readonly expiresAt: string;
  }>;
}): Promise<MintedShareDownload> {
  if (env.fileId === null) {
    return { downloadUrl: null, downloadExpiresAt: null };
  }
  try {
    const minted = await env.issueShareDownload(env.fileId);
    return {
      downloadUrl: minted.downloadUrl,
      downloadExpiresAt: new Date(minted.expiresAt),
    };
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { downloadUrl: null, downloadExpiresAt: null };
    }
    throw error;
  }
}

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
  const minted = await mintShareDownload(env);
  return {
    pdfDownloadUrl: minted.downloadUrl,
    pdfDownloadExpiresAt: minted.downloadExpiresAt,
  };
}
