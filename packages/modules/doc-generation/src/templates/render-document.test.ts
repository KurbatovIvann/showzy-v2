import { beforeAll, describe, expect, it } from "vitest";

import { CoreInvariantError } from "@showzy/core/errors";

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

describe(
  "system TSX document templates",
  { timeout: PDF_RENDER_TIMEOUT_MS },
  () => {
    beforeAll(async () => {
      await renderDocumentPdfBytes(invoice);
    }, PDF_RENDER_TIMEOUT_MS);

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
        expect(String.fromCharCode(...bytes.subarray(0, 4)), templateName).toBe(
          "%PDF",
        );
        expect(bytes.byteLength).toBeGreaterThan(100);
      }
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
