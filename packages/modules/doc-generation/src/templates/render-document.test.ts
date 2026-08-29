import { describe, expect, it } from "vitest";

import type { DocumentPdfModel } from "./model.js";
import { renderDocumentPdfBytes } from "./render-document.js";

const invoice: DocumentPdfModel = {
  type: "payment_invoice",
  documentNumber: "KA-РХ-000001",
  issuedOn: "2026-03-15",
  currency: "UAH",
  supplier: {
    name: "Konditerska Anna",
    legalName: "ТОВ Альфа",
    edrpou: "12345678",
    legalAddress: "вул. Хрещатик, 1",
    iban: "UA123456789012345678901234567",
    bankName: "ПриватБанк",
    bankMfo: "300001",
    phone: "+380501111111",
    email: "legal@alpha.test",
  },
  buyer: { kind: "customer", displayName: "Customer A" },
  items: [
    {
      itemId: "11111111-1111-4111-8111-111111111111",
      title: "Cake",
      quantityMilli: "1000",
      unitPriceMinor: "250",
      netAmountMinor: "250",
      grossAmountMinor: "250",
    },
  ],
  totalNetMinor: "250",
  totalTaxMinor: "0",
  totalGrossMinor: "250",
};

const delivery: DocumentPdfModel = {
  ...invoice,
  type: "delivery_note",
  documentNumber: "KA-ВН-000001",
  buyer: {
    kind: "counterparty",
    name: "ТОВ Покупець",
    edrpou: "11223344",
    legalAddress: "вул. Покупця, 2",
    iban: null,
    bankName: null,
    bankMfo: null,
    phone: null,
    email: null,
  },
};

describe("system TSX document templates", () => {
  it("renders a payment invoice PDF", async () => {
    const bytes = await renderDocumentPdfBytes(invoice);
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe("%PDF");
    expect(bytes.byteLength).toBeGreaterThan(100);
  });

  it("renders a delivery note PDF", async () => {
    const bytes = await renderDocumentPdfBytes(delivery);
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe("%PDF");
    expect(bytes.byteLength).toBeGreaterThan(100);
  });
});
