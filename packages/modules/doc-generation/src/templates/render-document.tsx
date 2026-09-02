import { Readable } from "node:stream";

import { pdf } from "@react-pdf/renderer";
import { CoreInvariantError } from "@showzy/core/errors";

import { canonicalizeLayoutKey, layoutRowForKey } from "../services/layouts.js";
import { DocumentPdf } from "./document-pdf.js";
import type { DocumentPdfModel } from "./model.js";

function isReadableStream(value: unknown): value is Readable {
  return value instanceof Readable;
}

async function collectPdfBytes(value: unknown): Promise<Uint8Array> {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (isReadableStream(value)) {
    const chunks: Buffer[] = [];
    for await (const chunk of value) {
      if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk));
      } else if (chunk instanceof Uint8Array) {
        chunks.push(Buffer.from(chunk));
      } else {
        throw new CoreInvariantError(
          "react-pdf stream emitted a non-byte chunk",
        );
      }
    }
    return Buffer.concat(chunks);
  }
  throw new CoreInvariantError("react-pdf toBuffer did not return bytes");
}

function pdfElementForModel(model: DocumentPdfModel) {
  const canonical = canonicalizeLayoutKey(model.templateName);
  if (canonical === null) {
    throw new CoreInvariantError(
      `unknown document layout "${model.templateName}"`,
    );
  }
  const row = layoutRowForKey(canonical);
  if (row.type !== model.type) {
    throw new CoreInvariantError(
      `document layout "${canonical}" does not match type "${model.type}"`,
    );
  }
  // T4 (SHO-364) replaces branded/parties with dedicated TSX. Until then
  // every catalog key reuses stacked DocumentPdf so render still yields %PDF.
  return <DocumentPdf model={model} />;
}

export async function renderDocumentPdfBytes(
  model: DocumentPdfModel,
): Promise<Uint8Array> {
  const instance = pdf(pdfElementForModel(model));
  const result: unknown = await instance.toBuffer();
  const bytes = await collectPdfBytes(result);
  if (bytes.byteLength < 5) {
    throw new CoreInvariantError("react-pdf produced an empty document");
  }
  return bytes;
}
