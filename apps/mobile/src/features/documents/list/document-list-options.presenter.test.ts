import { describe, expect, it } from "vitest";

import {
  documentOptionsRowForId,
  presentDocumentOptionsGetFields,
} from "./document-list-options.presenter";
import type { DocumentsListRow } from "./documents-list.presenter";

const DOCUMENT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

function row(overrides: Partial<DocumentsListRow> = {}): DocumentsListRow {
  return {
    id: DOCUMENT_ID,
    documentNumber: "SHZ-РХ-000001",
    typeLabel: "Рахунок",
    buyerLabel: "Марія",
    issuedOnLabel: "29 серп. 2026",
    totalLabel: "1 250 ₴",
    cancelled: false,
    status: "issued",
    optionsA11y: "Options",
    showSign: true,
    showSignedChip: false,
    ...overrides,
  };
}

describe("documentOptionsRowForId", () => {
  it("returns the matching row or null", () => {
    const entry = row();
    expect(documentOptionsRowForId([entry], DOCUMENT_ID)).toBe(entry);
    expect(documentOptionsRowForId([entry], null)).toBeNull();
    expect(
      documentOptionsRowForId(
        [entry],
        "11111111-1111-4111-8111-111111111111",
      ),
    ).toBeNull();
  });
});

describe("presentDocumentOptionsGetFields", () => {
  it("projects generation and signing only when get is ready", () => {
    expect(
      presentDocumentOptionsGetFields({
        getLoad: { kind: "loading" },
        generationStatus: "ready",
        pdfDownloadUrl: "https://example.test/doc.pdf",
        signingStatus: "pending",
      }),
    ).toEqual({
      generationStatus: null,
      pdfDownloadUrl: null,
      signingStatus: null,
    });
    expect(
      presentDocumentOptionsGetFields({
        getLoad: { kind: "ready" },
        generationStatus: "ready",
        pdfDownloadUrl: "https://example.test/doc.pdf",
        signingStatus: "pending",
      }),
    ).toEqual({
      generationStatus: "ready",
      pdfDownloadUrl: "https://example.test/doc.pdf",
      signingStatus: "pending",
    });
  });
});
