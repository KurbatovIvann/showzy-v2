/**
 * Options-sheet view-model projection (SHO-306). Composer keeps Query
 * + sheet chrome; this file stays React-free.
 */
import type {
  DocumentOptionsGetLoadState,
  DocumentSigningStatus,
  DocumentsListRow,
} from "./documents-list.presenter";

export function documentOptionsRowForId(
  rows: readonly DocumentsListRow[],
  documentId: string | null,
): DocumentsListRow | null {
  if (documentId === null) {
    return null;
  }
  return rows.find((row) => row.id === documentId) ?? null;
}

export function presentDocumentOptionsGetFields(args: {
  readonly getLoad: DocumentOptionsGetLoadState;
  readonly generationStatus: "pending" | "ready" | "failed" | undefined;
  readonly pdfDownloadUrl: string | null | undefined;
  readonly signingStatus: DocumentSigningStatus | undefined;
}): {
  readonly generationStatus: "pending" | "ready" | "failed" | null;
  readonly pdfDownloadUrl: string | null;
  readonly signingStatus: DocumentSigningStatus | null;
} {
  if (args.getLoad.kind !== "ready") {
    return {
      generationStatus: null,
      pdfDownloadUrl: null,
      signingStatus: null,
    };
  }
  return {
    generationStatus: args.generationStatus ?? null,
    pdfDownloadUrl: args.pdfDownloadUrl ?? null,
    signingStatus: args.signingStatus ?? null,
  };
}
