import { describe, expect, it } from "vitest";

import { CoreInvariantError } from "@showzy/core/errors";

import { mapViewToPdfModel } from "./render-pdf.js";

const uahView = {
  type: "payment_invoice" as const,
  templateName: "payment_invoice",
  documentNumber: "KA-РХ-000001",
  issuedOn: "2026-03-15",
  currency: "UAH",
  supplierDetails: {
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
  buyerDetails: {
    kind: "customer" as const,
    displayName: "Customer A",
  },
  items: [
    {
      itemId: "11111111-1111-4111-8111-111111111111",
      titleSnapshot: "Cake",
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

describe("mapViewToPdfModel", () => {
  it("maps a UAH snapshot without relabeling currency", () => {
    const model = mapViewToPdfModel(uahView);
    expect(model.currency).toBe("UAH");
    expect(model.documentNumber).toBe("KA-РХ-000001");
    expect(model.templateName).toBe("payment_invoice");
    expect(model.items).toHaveLength(1);
  });

  it("fails closed on a non-UAH money snapshot", () => {
    expect(() => mapViewToPdfModel({ ...uahView, currency: "USD" })).toThrow(
      CoreInvariantError,
    );
    expect(() => mapViewToPdfModel({ ...uahView, currency: "EUR" })).toThrow(
      /not UAH/,
    );
  });
});
