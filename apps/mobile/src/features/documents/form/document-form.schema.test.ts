import { describe, expect, it } from "vitest";

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
    ...overrides,
  };
}

describe("documentFormDraftSchema", () => {
  it("requires an order and type; counterparty is optional", () => {
    const parsed = documentFormDraftSchema.safeParse(emptyDocumentFormDraft());
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    const errors = fieldErrorsFromDraftSchema(parsed.error);
    expect(errors.order).toBe("required");
    expect(isOrderErrorKey("required")).toBe(true);
    expect(DOCUMENT_FORM_TYPES).toEqual(["payment_invoice", "delivery_note"]);
    expect(emptyFieldErrors()).toEqual({ order: null });
  });

  it("accepts invoice or delivery note with an optional counterparty", () => {
    expect(documentFormDraftSchema.safeParse(validDraft()).success).toBe(true);
    expect(
      documentFormDraftSchema.safeParse(
        validDraft({
          type: "delivery_note",
          counterpartyId: COUNTERPARTY_ID,
        }),
      ).success,
    ).toBe(true);
  });
});
