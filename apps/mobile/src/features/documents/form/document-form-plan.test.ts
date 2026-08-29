import { describe, expect, it } from "vitest";

import {
  emptyDocumentFormDraft,
  type DocumentFormDraft,
} from "./document-form-draft";
import {
  createFromOrderPayload,
  parseThenPlanDocumentFormSave,
  planDocumentFormSave,
  type DocumentFormWrite,
} from "./document-form-plan";

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

describe("createFromOrderPayload", () => {
  it("emits wire { orderId, type } only — no money, template, city, or customerId", () => {
    const payload = createFromOrderPayload(validDraft());
    expect(payload).toEqual({
      orderId: ORDER_ID,
      type: "payment_invoice",
    });
    expect(Object.keys(payload ?? {}).sort()).toEqual(["orderId", "type"]);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("total");
    expect(serialized).not.toContain("template");
    expect(serialized).not.toContain("city");
    expect(serialized).not.toContain("customerId");
    expect(serialized).not.toContain("counterpartyId");
    expect(serialized).not.toContain("money");
  });

  it("includes optional counterpartyId only when set", () => {
    const withCounterparty = createFromOrderPayload(
      validDraft({
        type: "delivery_note",
        counterpartyId: COUNTERPARTY_ID,
      }),
    );
    expect(withCounterparty).toEqual({
      orderId: ORDER_ID,
      type: "delivery_note",
      counterpartyId: COUNTERPARTY_ID,
    });
    expect(Object.keys(withCounterparty ?? {}).sort()).toEqual([
      "counterpartyId",
      "orderId",
      "type",
    ]);
    expect(createFromOrderPayload(validDraft({ counterpartyId: "" }))).toEqual({
      orderId: ORDER_ID,
      type: "payment_invoice",
    });
  });
});

describe("planDocumentFormSave", () => {
  it("submits create and retries the same attempt after a network failure", () => {
    const first = planDocumentFormSave({
      draft: validDraft(),
      lastWrite: null,
      lastFailureKind: null,
    });
    expect(first.kind).toBe("write");
    if (first.kind !== "write") {
      return;
    }
    expect(first.write.kind).toBe("createFromOrder");
    expect(
      planDocumentFormSave({
        draft: validDraft(),
        lastWrite: first.write,
        lastFailureKind: "network",
      }),
    ).toEqual({ kind: "retry" });
  });

  it("stays invalid without calling transport", () => {
    expect(
      planDocumentFormSave({
        draft: emptyDocumentFormDraft(),
        lastWrite: null,
        lastFailureKind: null,
      }).kind,
    ).toBe("invalid");
    expect(
      parseThenPlanDocumentFormSave({
        draft: emptyDocumentFormDraft(),
        lastWrite: null,
        lastFailureKind: null,
      }).kind,
    ).toBe("invalid");
  });

  it("does not retry a different payload", () => {
    const lastWrite: DocumentFormWrite = {
      kind: "createFromOrder",
      input: {
        orderId: ORDER_ID,
        type: "delivery_note",
      },
    };
    const planned = planDocumentFormSave({
      draft: validDraft(),
      lastWrite,
      lastFailureKind: "network",
    });
    expect(planned.kind).toBe("write");
  });
});
