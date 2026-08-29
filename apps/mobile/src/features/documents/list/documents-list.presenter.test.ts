import { describe, expect, it } from "vitest";

import { documentsCopy } from "../../../i18n/documents";
import type { DocumentListItem } from "../api/document.queries";
import {
  classifyDocumentOptionsGet,
  classifyDocumentsList,
  documentOptionVisibility,
  documentsFilteredEmptyView,
  documentsHeaderActions,
  flattenDocumentPages,
  hasDocumentsListFilter,
  isCancelledStatus,
  listDocumentsPageInput,
  toDocumentRowView,
} from "./documents-list.presenter";

const DOCUMENT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const ORDER_ID = "1f0e2d5c-4a1b-4c3d-9e8f-102938475602";

function item(overrides: Partial<DocumentListItem> = {}): DocumentListItem {
  return {
    documentId: DOCUMENT_ID,
    type: "payment_invoice",
    documentNumber: "SHZ-РХ-000001",
    orderId: ORDER_ID,
    counterpartyId: null,
    status: "issued",
    totalGrossMinor: "125000",
    currency: "UAH",
    issuedOn: "2026-08-29",
    createdAt: "2026-08-29T12:00:00.000Z",
    buyerLabel: "ФОП Кековченко І. В.",
    ...overrides,
  };
}

describe("listDocumentsPageInput", () => {
  it("maps type chips onto the server type field and omits orderId when unset", () => {
    expect(listDocumentsPageInput("all", null)).toEqual({ type: "all" });
    expect(listDocumentsPageInput("payment_invoice", null)).toEqual({
      type: "payment_invoice",
    });
    expect(listDocumentsPageInput("delivery_note", ORDER_ID)).toEqual({
      type: "delivery_note",
      orderId: ORDER_ID,
    });
    expect(listDocumentsPageInput("all", null)).not.toHaveProperty("orderId");
  });
});

describe("flattenDocumentPages", () => {
  it("concatenates page items in order", () => {
    const first = item({
      documentId: "11111111-1111-4111-8111-111111111111",
    });
    const second = item({
      documentId: "22222222-2222-4222-8222-222222222222",
    });
    expect(
      flattenDocumentPages([{ items: [first] }, { items: [second] }]),
    ).toEqual([first, second]);
  });
});

describe("toDocumentRowView", () => {
  it("uses the list snapshot buyer label, not a live CRM join", () => {
    const copy = documentsCopy("uk");
    const view = toDocumentRowView(
      item({ buyerLabel: "ТОВ «Кава Ранку»", status: "cancelled" }),
      { locale: "uk", copy },
    );
    expect(view.buyerLabel).toBe("ТОВ «Кава Ранку»");
    expect(view.documentNumber).toBe("SHZ-РХ-000001");
    expect(view.typeLabel).toBe("Рахунок");
    expect(view.cancelled).toBe(true);
    expect(view.status).toBe("cancelled");
    expect(view).not.toHaveProperty("generation");
    expect(view).not.toHaveProperty("orderStatus");
    expect(view).not.toHaveProperty("orderNumber");
  });

  it("maps delivery notes and issued rows without a cancelled pill", () => {
    const copy = documentsCopy("uk");
    const view = toDocumentRowView(
      item({ type: "delivery_note", status: "issued" }),
      { locale: "uk", copy },
    );
    expect(view.typeLabel).toBe("Видаткова");
    expect(view.cancelled).toBe(false);
    expect(isCancelledStatus("issued")).toBe(false);
    expect(isCancelledStatus("cancelled")).toBe(true);
  });
});

describe("classifyDocumentsList", () => {
  const base = {
    clientReady: true,
    status: "success" as const,
    failureKind: null,
    rowCount: 0,
    type: "all" as const,
    orderId: null,
  };

  it("is an error when the client is not ready", () => {
    expect(classifyDocumentsList({ ...base, clientReady: false })).toEqual({
      kind: "error",
    });
  });

  it("is loading while the list query is pending", () => {
    expect(classifyDocumentsList({ ...base, status: "pending" })).toEqual({
      kind: "loading",
    });
  });

  it("splits offline from other failures", () => {
    expect(
      classifyDocumentsList({
        ...base,
        status: "error",
        failureKind: "offline",
      }),
    ).toEqual({ kind: "offline" });
    expect(
      classifyDocumentsList({
        ...base,
        status: "error",
        failureKind: "network",
      }),
    ).toEqual({ kind: "error" });
  });

  it("shows rows whenever any are loaded", () => {
    expect(classifyDocumentsList({ ...base, rowCount: 3 })).toEqual({
      kind: "rows",
    });
  });

  it("maps type chips other than all, and an orderId filter, to filtered-empty", () => {
    expect(classifyDocumentsList({ ...base, type: "payment_invoice" })).toEqual(
      { kind: "empty-filtered" },
    );
    expect(classifyDocumentsList({ ...base, type: "delivery_note" })).toEqual({
      kind: "empty-filtered",
    });
    expect(classifyDocumentsList({ ...base, orderId: ORDER_ID })).toEqual({
      kind: "empty-filtered",
    });
    expect(hasDocumentsListFilter({ type: "all", orderId: null })).toBe(false);
    expect(
      hasDocumentsListFilter({ type: "payment_invoice", orderId: null }),
    ).toBe(true);
    expect(hasDocumentsListFilter({ type: "all", orderId: ORDER_ID })).toBe(
      true,
    );
  });

  it("maps an unfiltered empty page to catalog-empty", () => {
    expect(classifyDocumentsList(base)).toEqual({ kind: "empty-catalog" });
  });
});

describe("documentsFilteredEmptyView", () => {
  const copy = documentsCopy("en");

  it("hides Reset when nothing is filtered", () => {
    expect(
      documentsFilteredEmptyView({ type: "all", orderId: null, copy }),
    ).toEqual({
      showReset: false,
      description: copy.empty.filteredDescription,
    });
  });

  it("clears type only when the list is also order-scoped", () => {
    expect(
      documentsFilteredEmptyView({
        type: "payment_invoice",
        orderId: ORDER_ID,
        copy,
      }),
    ).toEqual({
      showReset: true,
      description: copy.empty.filteredTypeAndOrderDescription,
    });
  });

  it("keeps Reset for an order-only empty list so navigation can drop orderId", () => {
    expect(
      documentsFilteredEmptyView({ type: "all", orderId: ORDER_ID, copy }),
    ).toEqual({
      showReset: true,
      description: copy.empty.filteredOrderDescription,
    });
  });

  it("keeps the type-filter copy when only a type chip is set", () => {
    expect(
      documentsFilteredEmptyView({
        type: "delivery_note",
        orderId: null,
        copy,
      }),
    ).toEqual({
      showReset: true,
      description: copy.empty.filteredDescription,
    });
  });
});

describe("classifyDocumentOptionsGet", () => {
  const base = {
    documentId: DOCUMENT_ID,
    clientReady: true,
    status: "success" as const,
    failureKind: null,
  };

  it("is idle when the sheet has no selected document", () => {
    expect(classifyDocumentOptionsGet({ ...base, documentId: null })).toEqual({
      kind: "idle",
    });
  });

  it("is an error when the client is not ready", () => {
    expect(classifyDocumentOptionsGet({ ...base, clientReady: false })).toEqual(
      { kind: "error" },
    );
  });

  it("is loading while the get is pending", () => {
    expect(classifyDocumentOptionsGet({ ...base, status: "pending" })).toEqual({
      kind: "loading",
    });
  });

  it("splits offline from other get failures", () => {
    expect(
      classifyDocumentOptionsGet({
        ...base,
        status: "error",
        failureKind: "offline",
      }),
    ).toEqual({ kind: "offline" });
    expect(
      classifyDocumentOptionsGet({
        ...base,
        status: "error",
        failureKind: "network",
      }),
    ).toEqual({ kind: "error" });
  });

  it("is ready on a successful get", () => {
    expect(classifyDocumentOptionsGet(base)).toEqual({ kind: "ready" });
  });
});

describe("documentsHeaderActions", () => {
  it("hides Plus without documents:create; the list still loads with view", () => {
    expect(documentsHeaderActions({ canCreate: false })).toEqual({
      showCreate: false,
    });
    expect(documentsHeaderActions({ canCreate: true })).toEqual({
      showCreate: true,
    });
  });
});

describe("documentOptionVisibility", () => {
  const readyPdf = {
    canView: true,
    canEdit: false,
    status: "issued" as const,
    getLoad: "ready" as const,
    generationStatus: "ready" as const,
    pdfDownloadUrl: "https://example.test/pdf",
  };

  it("hides share/QR/print/cancel without documents:edit; open PDF stays on view", () => {
    expect(documentOptionVisibility(readyPdf)).toEqual({
      showShare: false,
      showQr: false,
      showPrint: false,
      showOpenPdf: true,
      showCancel: false,
      pdfReady: true,
      openPdfEnabled: true,
    });
  });

  it("shows cancel only on issued when the role can edit", () => {
    expect(
      documentOptionVisibility({
        canView: true,
        canEdit: true,
        status: "issued",
        getLoad: "ready",
        generationStatus: "pending",
        pdfDownloadUrl: null,
      }).showCancel,
    ).toBe(true);
    expect(
      documentOptionVisibility({
        canView: true,
        canEdit: true,
        status: "cancelled",
        getLoad: "ready",
        generationStatus: "ready",
        pdfDownloadUrl: "https://example.test/pdf",
      }).showCancel,
    ).toBe(false);
  });

  it("treats PDF as ready only when a successful get has generation ready and a panel URL", () => {
    expect(
      documentOptionVisibility({
        canView: true,
        canEdit: true,
        status: "issued",
        getLoad: "ready",
        generationStatus: "ready",
        pdfDownloadUrl: null,
      }).pdfReady,
    ).toBe(false);
    expect(
      documentOptionVisibility({
        canView: true,
        canEdit: true,
        status: "issued",
        getLoad: "ready",
        generationStatus: "failed",
        pdfDownloadUrl: "https://example.test/pdf",
      }).pdfReady,
    ).toBe(false);
    expect(
      documentOptionVisibility({
        canView: true,
        canEdit: true,
        status: "issued",
        getLoad: "ready",
        generationStatus: "pending",
        pdfDownloadUrl: null,
      }).openPdfEnabled,
    ).toBe(false);
  });

  it("does not collapse a get error into not-ready PDF with no retry", () => {
    const failed = documentOptionVisibility({
      canView: true,
      canEdit: true,
      status: "issued",
      getLoad: "error",
      generationStatus: null,
      pdfDownloadUrl: null,
    });
    expect(failed.pdfReady).toBe(false);
    expect(failed.openPdfEnabled).toBe(true);
    expect(failed.showOpenPdf).toBe(true);
    const offline = documentOptionVisibility({
      canView: true,
      canEdit: true,
      status: "issued",
      getLoad: "offline",
      generationStatus: "pending",
      pdfDownloadUrl: null,
    });
    expect(offline.pdfReady).toBe(false);
    expect(offline.openPdfEnabled).toBe(true);
    const employee = documentOptionVisibility({
      canView: true,
      canEdit: false,
      status: "issued",
      getLoad: "error",
      generationStatus: null,
      pdfDownloadUrl: null,
    });
    expect(employee.showOpenPdf).toBe(true);
    expect(employee.openPdfEnabled).toBe(true);
    expect(employee.pdfReady).toBe(false);
  });

  it("keeps Print/Open PDF disabled while the get is still loading", () => {
    const loading = documentOptionVisibility({
      canView: true,
      canEdit: true,
      status: "issued",
      getLoad: "loading",
      generationStatus: null,
      pdfDownloadUrl: null,
    });
    expect(loading.pdfReady).toBe(false);
    expect(loading.openPdfEnabled).toBe(false);
  });
});
