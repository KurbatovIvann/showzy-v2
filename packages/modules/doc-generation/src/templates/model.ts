export interface SellerFace {
  readonly name: string;
  readonly companyType: "fop" | "tov";
  readonly legalName: string | null;
  readonly edrpou: string | null;
  readonly legalAddress: string | null;
  readonly iban: string | null;
  readonly bankName: string | null;
  readonly bankMfo: string | null;
  readonly phone: string | null;
  readonly email: string | null;
}

export interface CounterpartyBuyerFace {
  readonly kind: "counterparty";
  readonly name: string;
  readonly edrpou: string | null;
  readonly legalAddress: string | null;
  readonly iban: string | null;
  readonly bankName: string | null;
  readonly bankMfo: string | null;
  readonly phone: string | null;
  readonly email: string | null;
}

export interface CustomerBuyerFace {
  readonly kind: "customer";
  readonly displayName: string;
}

export type BuyerFace = CounterpartyBuyerFace | CustomerBuyerFace;

export interface PdfLine {
  readonly itemId: string;
  readonly title: string;
  readonly quantityMilli: string;
  readonly unitPriceMinor: string;
  readonly netAmountMinor: string;
  readonly grossAmountMinor: string;
}

export interface DocumentPdfModel {
  readonly type: "payment_invoice" | "delivery_note";
  readonly templateName: string;
  readonly documentNumber: string;
  readonly issuedOn: string;
  readonly currency: string;
  /** Waybill «Підстава». T9 persists the column; T4 may set it on the model. */
  readonly basis: string | null;
  readonly supplier: SellerFace;
  readonly buyer: BuyerFace;
  readonly items: readonly PdfLine[];
  readonly totalNetMinor: string;
  readonly totalTaxMinor: string;
  readonly totalGrossMinor: string;
}

export const DOCUMENT_TITLE: Record<DocumentPdfModel["type"], string> = {
  payment_invoice: "Рахунок на оплату",
  delivery_note: "Видаткова накладна",
};
