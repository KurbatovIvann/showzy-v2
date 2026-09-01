import { classifyWriteFailure } from "../../../api/classify-write-failure";
import type { QueryFailureKind } from "../../../api/errors";
import type { DocumentsMutationCopy } from "../../../i18n/documents";

export type DocumentsWriteBannerKey = "offline" | "permission" | "error";

export function mapDocumentsWriteFailure(
  kind: QueryFailureKind | null,
): DocumentsWriteBannerKey | null {
  return classifyWriteFailure(kind);
}

export function documentsWriteBanner(
  key: DocumentsWriteBannerKey | null,
  copy: DocumentsMutationCopy,
): string | null {
  if (key === null) {
    return null;
  }
  if (key === "offline") {
    return copy.offline;
  }
  if (key === "permission") {
    return copy.permission;
  }
  return copy.error;
}

/** Coalesce local toast, share-mint, then cancel onto one list banner. */
export function presentDocumentWritesBanner(args: {
  readonly localBanner: string | null;
  readonly shareFailure: QueryFailureKind | null;
  readonly cancelFailure: QueryFailureKind | null;
  readonly mutationCopy: DocumentsMutationCopy;
}): string | null {
  return (
    args.localBanner ??
    documentsWriteBanner(
      mapDocumentsWriteFailure(args.shareFailure),
      args.mutationCopy,
    ) ??
    documentsWriteBanner(
      mapDocumentsWriteFailure(args.cancelFailure),
      args.mutationCopy,
    )
  );
}

/**
 * Share-mint catch: map through the same write-banner keys as cancel.
 * `fallback` is `toast.shareFailed` when the kind is not a write banner
 * (e.g. protocol confirmation).
 */
export function shareMintFailureBanner(
  kind: QueryFailureKind | null,
  mutationCopy: DocumentsMutationCopy,
  fallback: string,
): string {
  return (
    documentsWriteBanner(mapDocumentsWriteFailure(kind), mutationCopy) ??
    fallback
  );
}
