import { beforeAll, describe, expect, it } from "vitest";

import { CoreInvariantError } from "@showzy/core/errors";

import { extractPdfText } from "./extract-pdf-text.js";
import type { DocumentPdfModel } from "./model.js";
import { renderDocumentPdfBytes } from "./render-document.js";
import { DOCUMENT_LAYOUTS } from "../services/layouts.js";

/** First @react-pdf/renderer + Liberation Sans layout is slow on GitHub runners. */
const PDF_RENDER_TIMEOUT_MS = 30_000;

const invoice: DocumentPdfModel = {
  type: "payment_invoice",
  templateName: "payment_invoice",
  documentNumber: "KA-РХ-000001",
  issuedOn: "2026-03-15",
  currency: "UAH",
  basis: null,
  supplier: {
    name: "Konditerska Anna",
    companyType: "tov",
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
  templateName: "delivery_note",
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

function pdfMagic(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes.subarray(0, 4));
}

describe(
  "system TSX document templates",
  { timeout: PDF_RENDER_TIMEOUT_MS },
  () => {
    beforeAll(async () => {
      await renderDocumentPdfBytes(invoice);
    }, PDF_RENDER_TIMEOUT_MS);

    it("renders a payment invoice PDF", async () => {
      const bytes = await renderDocumentPdfBytes(invoice);
      expect(pdfMagic(bytes)).toBe("%PDF");
      expect(bytes.byteLength).toBeGreaterThan(100);
    });

    it("renders a delivery note PDF", async () => {
      const bytes = await renderDocumentPdfBytes(delivery);
      expect(pdfMagic(bytes)).toBe("%PDF");
      expect(bytes.byteLength).toBeGreaterThan(100);
    });

    it("renders %PDF for every catalog key and legacy type alias", async () => {
      const names = [
        ...DOCUMENT_LAYOUTS.map((row) => row.key),
        "payment_invoice",
        "delivery_note",
      ] as const;
      for (const templateName of names) {
        const type = templateName.startsWith("delivery_note")
          ? ("delivery_note" as const)
          : ("payment_invoice" as const);
        const model =
          type === "delivery_note"
            ? { ...delivery, templateName }
            : { ...invoice, templateName };
        const bytes = await renderDocumentPdfBytes(model);
        expect(pdfMagic(bytes), templateName).toBe("%PDF");
        expect(bytes.byteLength).toBeGreaterThan(100);
      }
    });

    it("emits branded invoice strings and omits the payment badge", async () => {
      const bytes = await renderDocumentPdfBytes({
        ...invoice,
        templateName: "payment_invoice.branded",
      });
      expect(pdfMagic(bytes)).toBe("%PDF");
      const text = extractPdfText(bytes);
      expect(text).toContain("РАХУНОК-ФАКТУРА");
      expect(text).toContain("ПЛАТНИК:");
      expect(text).toContain("Customer A");
      expect(text).not.toContain("Очікує оплати");
      expect(text).not.toContain("Рахунок на оплату");
    });

    it("renders the branded payer block for a customer buyer with no legal face", async () => {
      const bytes = await renderDocumentPdfBytes({
        ...invoice,
        templateName: "payment_invoice.branded",
        buyer: { kind: "customer", displayName: "Олена Коваленко" },
      });
      const text = extractPdfText(bytes);
      expect(text).toContain("РАХУНОК-ФАКТУРА");
      expect(text).toContain("ПЛАТНИК:");
      expect(text).toContain("Олена Коваленко");
    });

    it("emits parties waybill strings and omits Підстава when basis is null", async () => {
      const bytes = await renderDocumentPdfBytes({
        ...delivery,
        templateName: "delivery_note.parties",
        basis: null,
      });
      expect(pdfMagic(bytes)).toBe("%PDF");
      const text = extractPdfText(bytes);
      expect(text).toContain("ВИДАТКОВА");
      expect(text).toContain("Постачальник");
      expect(text).toContain("Покупець");
      expect(text).toContain("ТОВ Покупець");
      expect(text).not.toContain("Підстава");
      expect(text).not.toContain("Директор");
      const afterReceived = text.split("Отримав").slice(1).join("Отримав");
      expect(afterReceived).not.toContain("ТОВ Покупець");
    });

    it("prints Підстава when the PDF model carries a basis string", async () => {
      const bytes = await renderDocumentPdfBytes({
        ...delivery,
        templateName: "delivery_note.parties",
        basis: "Договір поставки № 15/2026 від 10.01.2026 р.",
      });
      const text = extractPdfText(bytes);
      expect(text).toContain("Підстава");
      expect(text).toContain("Договір поставки № 15/2026 від 10.01.2026 р.");
    });

    it("keeps legacy aliases on the stacked plain layout", async () => {
      const invoiceText = extractPdfText(
        await renderDocumentPdfBytes({
          ...invoice,
          templateName: "payment_invoice",
        }),
      );
      expect(invoiceText).toContain("Рахунок на оплату");
      expect(invoiceText).not.toContain("РАХУНОК-ФАКТУРА");
      const noteText = extractPdfText(
        await renderDocumentPdfBytes({
          ...delivery,
          templateName: "delivery_note",
        }),
      );
      expect(noteText).toContain("Видаткова накладна");
      expect(noteText).not.toContain("ВИДАТКОВА НАКЛАДНА");
    });

    it("fails closed on an unknown layout or a key/type mismatch", async () => {
      await expect(
        renderDocumentPdfBytes({
          ...invoice,
          templateName: "payment_invoice.custom",
        }),
      ).rejects.toBeInstanceOf(CoreInvariantError);
      await expect(
        renderDocumentPdfBytes({
          ...delivery,
          templateName: "payment_invoice.plain",
        }),
      ).rejects.toBeInstanceOf(CoreInvariantError);
    });
  },
);
