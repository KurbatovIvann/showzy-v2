import { describe, expect, it } from "vitest";

import { DOCUMENT_BASIS_MAX } from "../shared/document-caps";
import {
  DOCUMENT_FORM_TYPES,
  documentFormDraftSchema,
  emptyFieldErrors,
  fieldErrorsFromDraftSchema,
  isOrderErrorKey,
} from "./document-form.schema";
import {
  emptyDocumentFormDraft,
  type DocumentFormDraft,
} from "./document-form-draft";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const COUNTERPARTY_ID = "22222222-2222-4222-8222-222222222222";

function validDraft(
  overrides: Partial<DocumentFormDraft> = {},
): DocumentFormDraft {
  return {
    type: "payment_invoice",
    orderId: ORDER_ID,
    counterpartyId: "",
    layoutKey: "payment_invoice.branded",
    basis: "",
    ...overrides,
  };
}

describe("documentFormDraftSchema", () => {
  it("requires an order, type, and layout; counterparty and basis are optional", () => {
    const parsed = documentFormDraftSchema.safeParse(emptyDocumentFormDraft());
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    const errors = fieldErrorsFromDraftSchema(parsed.error);
    expect(errors.order).toBe("required");
    expect(errors.layout).toBe("required");
    expect(errors.basis).toBeNull();
    expect(isOrderErrorKey("required")).toBe(true);
    expect(DOCUMENT_FORM_TYPES).toEqual(["payment_invoice", "delivery_note"]);
    expect(emptyFieldErrors()).toEqual({
      order: null,
      layout: null,
      basis: null,
    });
  });

  it("accepts invoice or delivery note with optional counterparty and basis", () => {
    expect(documentFormDraftSchema.safeParse(validDraft()).success).toBe(true);
    expect(
      documentFormDraftSchema.safeParse(
        validDraft({
          type: "delivery_note",
          counterpartyId: COUNTERPARTY_ID,
          layoutKey: "delivery_note.parties",
          basis: "Договір № 1",
        }),
      ).success,
    ).toBe(true);
    expect(
      documentFormDraftSchema.safeParse(
        validDraft({ basis: "x".repeat(DOCUMENT_BASIS_MAX) }),
      ).success,
    ).toBe(true);
    const tooLong = documentFormDraftSchema.safeParse(
      validDraft({ basis: "x".repeat(DOCUMENT_BASIS_MAX + 1) }),
    );
    expect(tooLong.success).toBe(false);
    if (tooLong.success) {
      return;
    }
    expect(fieldErrorsFromDraftSchema(tooLong.error).basis).toBe("too_long");
  });
});
