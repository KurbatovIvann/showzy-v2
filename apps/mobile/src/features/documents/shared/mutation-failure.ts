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
