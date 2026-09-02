import { describe, expect, it } from "vitest";

import { documentsCopy } from "../../../i18n/documents";
import { emptyDocumentFormDraft } from "./document-form-draft";
import {
  presentDocumentFormCopy,
  presentDocumentFormView,
} from "./document-form.presenter";

const copy = documentsCopy("uk");

const INVOICE_CARDS = [
  { key: "payment_invoice.plain", label: "Простий рахунок" },
  { key: "payment_invoice.branded", label: "Фірмовий рахунок" },
] as const;

const INVOICE_CATALOG = [
  {
    key: "payment_invoice.plain",
    type: "payment_invoice" as const,
    labelUk: "Простий рахунок",
    labelEn: "Plain invoice",
    isDefault: false,
  },
  {
    key: "payment_invoice.branded",
    type: "payment_invoice" as const,
    labelUk: "Фірмовий рахунок",
    labelEn: "Branded invoice",
    isDefault: true,
  },
];

describe("presentDocumentFormView", () => {
  it("hides submit without create permission and maps selector values", () => {
    const resolved = presentDocumentFormCopy({
      formCopy: copy.form,
      submitted: false,
      orderMessage: undefined,
      layoutMessage: undefined,
      basisMessage: undefined,
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
      layoutKey: "payment_invoice.branded",
      layoutCards: INVOICE_CARDS,
      layoutCatalog: INVOICE_CATALOG,
      layoutsStatus: "ready",
      layoutPreview: "Фірмовий рахунок",
      orderSheetOpen: false,
      counterpartySheetOpen: false,
    });
    expect(view.showSubmit).toBe(false);
    expect(view.fieldsEditable).toBe(false);
    expect(view.orderValue).toBe("Замовлення 1");
    expect(view.counterpartyValue).toBe("ТОВ");
    expect(view.basisVisible).toBe(false);
  });

  it("shows submit on a ready create draft once a layout is selected", () => {
    const resolved = presentDocumentFormCopy({
      formCopy: copy.form,
      submitted: false,
      orderMessage: undefined,
      layoutMessage: undefined,
      basisMessage: undefined,
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
      layoutKey: "payment_invoice.branded",
      layoutCards: INVOICE_CARDS,
      layoutCatalog: INVOICE_CATALOG,
      layoutsStatus: "ready",
      layoutPreview: "Фірмовий рахунок",
      orderSheetOpen: false,
      counterpartySheetOpen: false,
    });
    expect(view.showSubmit).toBe(true);
    expect(view.fieldsEditable).toBe(true);
    expect(view.submitDisabled).toBe(false);
    expect(view.selectedOrderId).toBeNull();
    expect(view.selectedCounterpartyId).toBeNull();
    expect(view.layoutKey).toBe("payment_invoice.branded");
  });

  it("hides basis for invoices and disables submit while layouts load", () => {
    const resolved = presentDocumentFormCopy({
      formCopy: copy.form,
      submitted: false,
      orderMessage: undefined,
      layoutMessage: undefined,
      basisMessage: undefined,
      mutationError: null,
      lastWrite: null,
      isMutationError: false,
      pending: false,
      clientReady: true,
      canCreate: true,
      created: false,
    });
    const loading = presentDocumentFormView({
      copy,
      loadState: { kind: "ready" },
      resolved,
      type: "payment_invoice",
      pending: false,
      canCreate: true,
      selectedOrder: null,
      selectedCounterparty: undefined,
      counterpartyEnabled: false,
      orderId: "",
      counterpartyId: "",
      layoutKey: "",
      layoutCards: [],
      layoutCatalog: [],
      layoutsStatus: "loading",
      layoutPreview: null,
      orderSheetOpen: false,
      counterpartySheetOpen: false,
    });
    expect(loading.submitDisabled).toBe(true);
    expect(loading.basisVisible).toBe(false);

    const note = presentDocumentFormView({
      copy,
      loadState: { kind: "ready" },
      resolved,
      type: "delivery_note",
      pending: false,
      canCreate: true,
      selectedOrder: null,
      selectedCounterparty: undefined,
      counterpartyEnabled: false,
      orderId: "",
      counterpartyId: "",
      layoutKey: "delivery_note.parties",
      layoutCards: [
        { key: "delivery_note.plain", label: "Проста накладна" },
        { key: "delivery_note.parties", label: "Накладна зі сторонами" },
      ],
      layoutCatalog: [
        {
          key: "delivery_note.plain",
          type: "delivery_note",
          labelUk: "Проста накладна",
          labelEn: "Plain delivery note",
          isDefault: false,
        },
        {
          key: "delivery_note.parties",
          type: "delivery_note",
          labelUk: "Накладна зі сторонами",
          labelEn: "Parties delivery note",
          isDefault: true,
        },
      ],
      layoutsStatus: "ready",
      layoutPreview: "Накладна зі сторонами",
      orderSheetOpen: false,
      counterpartySheetOpen: false,
    });
    expect(note.basisVisible).toBe(true);
    expect(note.submitDisabled).toBe(false);
  });
});
