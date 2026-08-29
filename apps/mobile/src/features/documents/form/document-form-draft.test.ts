import { describe, expect, it } from "vitest";

import {
  cloneDocumentFormDraft,
  emptyDocumentFormDraft,
  isDocumentFormDirty,
  parseDocumentFormUiDraft,
  validateDocumentForm,
  type DocumentFormDraft,
} from "./document-form-draft";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

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

describe("document form draft", () => {
  it("defaults to invoice with empty order and counterparty", () => {
    expect(emptyDocumentFormDraft()).toEqual({
      type: "payment_invoice",
      orderId: "",
      counterpartyId: "",
    });
    expect(cloneDocumentFormDraft(validDraft()).orderId).toBe(ORDER_ID);
  });

  it("is dirty when type, order, or counterparty change from origin", () => {
    const origin = emptyDocumentFormDraft();
    expect(isDocumentFormDirty(origin, origin)).toBe(false);
    expect(isDocumentFormDirty(validDraft(), origin)).toBe(true);
    expect(
      isDocumentFormDirty(validDraft({ type: "delivery_note" }), validDraft()),
    ).toBe(true);
    expect(
      isDocumentFormDirty(
        validDraft({ counterpartyId: "22222222-2222-4222-8222-222222222222" }),
        validDraft(),
      ),
    ).toBe(true);
  });

  it("parses a complete draft and rejects a missing order", () => {
    expect(parseDocumentFormUiDraft(validDraft())).toEqual({
      ok: true,
      draft: validDraft(),
    });
    expect(validateDocumentForm(emptyDocumentFormDraft()).order).toBe(
      "required",
    );
    expect(parseDocumentFormUiDraft(emptyDocumentFormDraft()).ok).toBe(false);
  });
});
