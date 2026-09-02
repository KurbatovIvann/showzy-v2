import { describe, expect, it } from "vitest";

import type { DocumentPdfModel } from "./model.js";
import {
  invoiceVatFootnote,
  payerLines,
  receivedPersonName,
  releasedPersonName,
  showFopVatExemptFootnote,
  tradeNameInitials,
  waybillVatFootnote,
} from "./pdf-faces.js";

const base: DocumentPdfModel = {
  type: "payment_invoice",
  templateName: "payment_invoice.branded",
  documentNumber: "KA-РХ-000001",
  issuedOn: "2026-03-15",
  currency: "UAH",
  basis: null,
  supplier: {
    name: "Konditerska Anna",
    companyType: "fop",
    legalName: "ФОП Курбатов Іван Олександрович",
    edrpou: "1234567890",
    legalAddress: "вул. Хрещатик, 1",
    iban: null,
    bankName: null,
    bankMfo: null,
    phone: null,
    email: null,
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

describe("pdf layout copy helpers", () => {
  it("takes initials from the trade name, not a files logo", () => {
    expect(tradeNameInitials("Konditerska Anna")).toBe("KA");
    expect(tradeNameInitials("Sophie")).toBe("SO");
    expect(tradeNameInitials("Sophie patisserie")).toBe("SP");
  });

  it("shows the FOP VAT footnote only when every line is tax-exempt", () => {
    expect(showFopVatExemptFootnote(base)).toBe(true);
    expect(invoiceVatFootnote(base)).toContain("неплатник ПДВ");
    expect(waybillVatFootnote(base)).toContain("неплатник ПДВ");
    expect(
      showFopVatExemptFootnote({
        ...base,
        supplier: { ...base.supplier, companyType: "tov" },
      }),
    ).toBe(false);
    expect(showFopVatExemptFootnote({ ...base, totalTaxMinor: "50" })).toBe(
      false,
    );
  });

  it("builds a payer block from a customer display name", () => {
    expect(
      payerLines({ kind: "customer", displayName: "Олена Коваленко" }),
    ).toEqual(["Олена Коваленко"]);
    expect(
      payerLines({
        kind: "counterparty",
        name: "ТОВ Покупець",
        edrpou: "11223344",
        legalAddress: null,
        iban: null,
        bankName: null,
        bankMfo: null,
        phone: "+380501111111",
        email: "buyer@example.com",
      }),
    ).toEqual([
      "ТОВ Покупець",
      "ЄДРПОУ: 11223344",
      "Тел.: +380501111111",
      "Email: buyer@example.com",
    ]);
  });

  it("leaves Отримав ПІБ blank for both buyer kinds", () => {
    expect(
      receivedPersonName({ kind: "customer", displayName: "Олена Коваленко" }),
    ).toBeNull();
    expect(
      receivedPersonName({
        kind: "counterparty",
        name: "ТОВ Покупець",
        edrpou: "11223344",
        legalAddress: null,
        iban: null,
        bankName: null,
        bankMfo: null,
        phone: null,
        email: null,
      }),
    ).toBeNull();
  });

  it("fills Відпустив ПІБ from seller legalName when present", () => {
    expect(releasedPersonName(base.supplier)).toBe(
      "ФОП Курбатов Іван Олександрович",
    );
    expect(
      releasedPersonName({ ...base.supplier, legalName: null }),
    ).toBeNull();
  });
});
