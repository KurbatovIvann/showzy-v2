import { describe, expect, it } from "vitest";

import {
  DELIVERY_NOTE_TYPE_CODE,
  documentTypeCode,
  formatDocumentNumber,
  PAYMENT_INVOICE_TYPE_CODE,
} from "./document-number.js";

describe("document numbering", () => {
  it("uses РХ / ВН type codes and a six-digit sequence with no year", () => {
    expect(documentTypeCode("payment_invoice")).toBe(PAYMENT_INVOICE_TYPE_CODE);
    expect(documentTypeCode("delivery_note")).toBe(DELIVERY_NOTE_TYPE_CODE);
    expect(formatDocumentNumber("KA", "payment_invoice", 1n)).toBe(
      "KA-РХ-000001",
    );
    expect(formatDocumentNumber("KA", "delivery_note", 12n)).toBe(
      "KA-ВН-000012",
    );
    expect(formatDocumentNumber("KA", "payment_invoice", 1n)).not.toMatch(
      /20\d{2}/,
    );
    expect(formatDocumentNumber("MB", "payment_invoice", 999999n)).toBe(
      "MB-РХ-999999",
    );
  });
});
