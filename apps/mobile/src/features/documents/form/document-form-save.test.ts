import { describe, expect, it } from "vitest";

import { emptyFieldErrors } from "./document-form.schema";
import {
  emptyDocumentFormDraft,
  type DocumentFormDraft,
  type DocumentFormFieldErrors,
} from "./document-form-draft";
import {
  type CreateFromOrderResult,
  type DocumentFormWrite,
} from "./document-form-plan";
import {
  runDocumentFormSave,
  type LastWriteFailure,
  type DocumentFormSavePorts,
} from "./document-form-save";

const DOCUMENT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const ORDER_ID = "11111111-1111-4111-8111-111111111111";

function validDraft(): DocumentFormDraft {
  return {
    type: "payment_invoice",
    orderId: ORDER_ID,
    counterpartyId: "",
  };
}

function createdDocument(): CreateFromOrderResult {
  return {
    documentId: DOCUMENT_ID,
    orderId: ORDER_ID,
    counterpartyId: null,
    type: "payment_invoice",
    status: "issued",
    documentNumber: "SHZ-РХ-000001",
    issuedOn: "2026-08-29",
    supplierDetails: {
      kind: "seller",
      name: "Showzy",
      prefix: "SHZ",
      companyType: "fop",
      legalName: "FOP",
      edrpou: "12345678",
      legalAddress: null,
      iban: null,
      bankName: null,
      bankMfo: null,
      bankEdrpou: null,
      phone: null,
      email: null,
    },
    buyerDetails: { kind: "customer", displayName: "Марія" },
    totalNetMinor: "1000",
    totalTaxMinor: "0",
    totalGrossMinor: "1000",
    currency: "UAH",
    templateSource: "system",
    templateName: "payment_invoice",
    createdAt: "2026-08-29T12:00:00.000Z",
    items: [
      {
        itemId: "33333333-3333-4333-8333-333333333333",
        productId: "44444444-4444-4444-8444-444444444444",
        variantId: null,
        titleSnapshot: "Торт",
        quantityMilli: "1000",
        unitPriceMinor: "1000",
        discountKind: "none",
        discountValue: "0",
        discountAmountMinor: "0",
        taxTreatment: "exempt",
        taxRateBp: 0,
        taxAmountMinor: "0",
        netAmountMinor: "1000",
        grossAmountMinor: "1000",
        currency: "UAH",
      },
    ],
  };
}

function createPorts(overrides: {
  readonly draft?: DocumentFormDraft;
  readonly submit?: (
    write: DocumentFormWrite,
  ) => Promise<CreateFromOrderResult>;
  readonly retry?: () => Promise<CreateFromOrderResult>;
  readonly lastFailure?: LastWriteFailure;
  readonly lastWrite?: DocumentFormWrite | null;
}) {
  const calls: string[] = [];
  const originDrafts: DocumentFormDraft[] = [];
  const finished: string[] = [];
  const draft = overrides.draft ?? validDraft();
  let lastWrite = overrides.lastWrite ?? null;
  let lastFailure = overrides.lastFailure ?? { kind: null, wire: null };
  let fieldErrors: DocumentFormFieldErrors = emptyFieldErrors();
  const ports: DocumentFormSavePorts = {
    getDraft: () => draft,
    setOrigin: (next) => {
      originDrafts.push(next);
    },
    getLastWrite: () => lastWrite,
    setLastWrite: (write) => {
      lastWrite = write;
    },
    getLastFailure: () => lastFailure,
    setLastFailure: (failure) => {
      lastFailure = failure;
    },
    setFieldErrors: (errors) => {
      fieldErrors = errors;
    },
    submit:
      overrides.submit ??
      ((write) => {
        calls.push(`submit:${write.kind}`);
        return Promise.resolve(createdDocument());
      }),
    retry:
      overrides.retry ??
      (() => {
        calls.push("retry");
        return Promise.resolve(createdDocument());
      }),
    resetMutation: () => {
      calls.push("reset");
    },
    finish: (result) => {
      finished.push(result.documentId);
      calls.push(`finish:${result.documentId}`);
      return Promise.resolve();
    },
  };
  return {
    ports,
    calls,
    originDrafts,
    finished,
    getFieldErrors: () => fieldErrors,
  };
}

describe("runDocumentFormSave", () => {
  it("submits create and finishes with the created documentId", async () => {
    const { ports, calls, originDrafts, finished } = createPorts({});
    await runDocumentFormSave(ports);
    expect(calls).toEqual([
      "submit:createFromOrder",
      "reset",
      `finish:${DOCUMENT_ID}`,
    ]);
    expect(finished).toEqual([DOCUMENT_ID]);
    expect(originDrafts).toHaveLength(1);
  });

  it("retries the in-flight attempt after a retryable failure", async () => {
    const lastWrite: DocumentFormWrite = {
      kind: "createFromOrder",
      input: {
        orderId: ORDER_ID,
        type: "payment_invoice",
      },
    };
    const { ports, calls } = createPorts({
      lastWrite,
      lastFailure: { kind: "network", wire: null },
    });
    await runDocumentFormSave(ports);
    expect(calls[0]).toBe("retry");
    expect(calls).toContain(`finish:${DOCUMENT_ID}`);
  });

  it("stops on an invalid draft without submitting", async () => {
    const { ports, calls, getFieldErrors } = createPorts({
      draft: emptyDocumentFormDraft(),
    });
    await runDocumentFormSave(ports);
    expect(calls).toEqual([]);
    expect(getFieldErrors().order).toBe("required");
  });
});
