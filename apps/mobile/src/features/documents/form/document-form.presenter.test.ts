import { describe, expect, it } from "vitest";

import { documentsCopy } from "../../../i18n/documents";
import { emptyDocumentFormDraft } from "./document-form-draft";
import {
  presentDocumentFormCopy,
  presentDocumentFormView,
} from "./document-form.presenter";

const copy = documentsCopy("uk");

describe("presentDocumentFormView", () => {
  it("hides submit without create permission and maps selector values", () => {
    const resolved = presentDocumentFormCopy({
      formCopy: copy.form,
      submitted: false,
      orderMessage: undefined,
      mutationError: null,
      lastWrite: null,
      isMutationError: false,
      pending: false,
      clientReady: true,
      canCreate: false,
      created: false,
    });
    const view = presentDocumentFormView({
      copy,
      loadState: { kind: "permission" },
      resolved,
      type: "payment_invoice",
      pending: false,
      canCreate: false,
      selectedOrder: { name: "Замовлення 1", description: "Марія" },
      selectedCounterparty: { name: "ТОВ", description: "12345678" },
      counterpartyEnabled: true,
      orderId: "11111111-1111-4111-8111-111111111111",
      counterpartyId: "22222222-2222-4222-8222-222222222222",
      orderSheetOpen: false,
      counterpartySheetOpen: false,
    });
    expect(view.showSubmit).toBe(false);
    expect(view.fieldsEditable).toBe(false);
    expect(view.orderValue).toBe("Замовлення 1");
    expect(view.counterpartyValue).toBe("ТОВ");
  });

  it("shows submit on a ready create draft", () => {
    const resolved = presentDocumentFormCopy({
      formCopy: copy.form,
      submitted: false,
      orderMessage: undefined,
      mutationError: null,
      lastWrite: null,
      isMutationError: false,
      pending: false,
      clientReady: true,
      canCreate: true,
      created: false,
    });
    const view = presentDocumentFormView({
      copy,
      loadState: { kind: "ready" },
      resolved,
      type: emptyDocumentFormDraft().type,
      pending: false,
      canCreate: true,
      selectedOrder: null,
      selectedCounterparty: undefined,
      counterpartyEnabled: false,
      orderId: "",
      counterpartyId: "",
      orderSheetOpen: false,
      counterpartySheetOpen: false,
    });
    expect(view.showSubmit).toBe(true);
    expect(view.fieldsEditable).toBe(true);
    expect(view.selectedOrderId).toBeNull();
    expect(view.selectedCounterpartyId).toBeNull();
  });
});
