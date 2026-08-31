import {
  catalogFilePurpose,
  documentFilePurpose,
  signingFilePurpose,
  type DocumentReadyView,
  type FileReadyView,
  type FileRow,
  type SigningReadyView,
} from "./file-purpose.js";

export type { DocumentReadyView, FileReadyView, FileRow, SigningReadyView };

export function toReadyView(row: FileRow): FileReadyView {
  return catalogFilePurpose.toReadyView(row);
}

export function requireDeclaredMime(
  value: string,
): ReturnType<typeof catalogFilePurpose.requireMime> {
  return catalogFilePurpose.requireMime(value);
}

export function requireDocumentMime(
  value: string,
): ReturnType<typeof documentFilePurpose.requireMime> {
  return documentFilePurpose.requireMime(value);
}

export function toDocumentReadyView(row: FileRow): DocumentReadyView {
  return documentFilePurpose.toReadyView(row);
}

export function requireSigningMime(
  value: string,
): ReturnType<typeof signingFilePurpose.requireMime> {
  return signingFilePurpose.requireMime(value);
}

export function toSigningReadyView(row: FileRow): SigningReadyView {
  return signingFilePurpose.toReadyView(row);
}
