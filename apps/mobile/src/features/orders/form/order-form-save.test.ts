import { describe, expect, it } from "vitest";

import { emptyFieldErrors } from "./order-form.schema";
import {
  emptyOrderFormDraft,
  type OrderFormDraft,
  type OrderFormFieldErrors,
} from "./order-form-draft";
import { type CreateOrderResult, type OrderFormWrite } from "./order-form-plan";
import {
  runOrderFormSave,
  type LastWriteFailure,
  type OrderFormSavePorts,
} from "./order-form-save";

const ORDER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";

function validDraft(): OrderFormDraft {
  return {
    customerId: CUSTOMER_ID,
    customerName: "Марія",
    comment: "",
    nextDraftSerial: 2,
    items: [
      {
        key: "draft-1",
        productId: PRODUCT_ID,
        variantId: null,
        productName: "Торт",
        variantName: null,
        quantityMilli: "1000",
      },
    ],
  };
}

function createdOrder(): CreateOrderResult {
  return {
    orderId: ORDER_ID,
    orderNumber: 1,
    customerId: CUSTOMER_ID,
    status: "new",
    comment: null,
    totalNetMinor: "1000",
    totalTaxMinor: "0",
    totalGrossMinor: "1000",
    currency: "UAH",
    confirmedAt: null,
    createdAt: "2026-08-29T12:00:00.000Z",
    items: [
      {
        itemId: "22222222-2222-4222-8222-222222222222",
        productId: PRODUCT_ID,
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
        priceSource: "base",
        personalPriceId: null,
        priceListId: null,
        priceListEntryId: null,
        resolverVersion: 1,
      },
    ],
  };
}

function createPorts(overrides: {
  readonly draft?: OrderFormDraft;
  readonly submit?: (write: OrderFormWrite) => Promise<CreateOrderResult>;
  readonly retry?: () => Promise<CreateOrderResult>;
  readonly lastFailure?: LastWriteFailure;
  readonly lastWrite?: OrderFormWrite | null;
}) {
  const calls: string[] = [];
  const originDrafts: OrderFormDraft[] = [];
  const finished: string[] = [];
  const draft = overrides.draft ?? validDraft();
  let lastWrite = overrides.lastWrite ?? null;
  let lastFailure = overrides.lastFailure ?? { kind: null, wire: null };
  let fieldErrors: OrderFormFieldErrors = emptyFieldErrors();
  const ports: OrderFormSavePorts = {
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
        return Promise.resolve(createdOrder());
      }),
    retry:
      overrides.retry ??
      (() => {
        calls.push("retry");
        return Promise.resolve(createdOrder());
      }),
    resetMutation: () => {
      calls.push("reset");
    },
    finish: (orderId) => {
      finished.push(orderId);
      calls.push(`finish:${orderId}`);
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

describe("runOrderFormSave", () => {
  it("submits create and finishes with the created orderId", async () => {
    const { ports, calls, originDrafts, finished } = createPorts({});
    await runOrderFormSave(ports);
    expect(calls).toEqual([
      "submit:createOrder",
      "reset",
      `finish:${ORDER_ID}`,
    ]);
    expect(finished).toEqual([ORDER_ID]);
    expect(originDrafts).toHaveLength(1);
  });

  it("retries the in-flight attempt after a retryable failure", async () => {
    const lastWrite: OrderFormWrite = {
      kind: "createOrder",
      input: {
        customerId: CUSTOMER_ID,
        items: [{ productId: PRODUCT_ID, quantityMilli: "1000" }],
      },
    };
    const { ports, calls } = createPorts({
      lastWrite,
      lastFailure: { kind: "network", wire: null },
    });
    await runOrderFormSave(ports);
    expect(calls[0]).toBe("retry");
    expect(calls).toContain(`finish:${ORDER_ID}`);
  });

  it("stops on an invalid draft without submitting", async () => {
    const { ports, calls, getFieldErrors } = createPorts({
      draft: emptyOrderFormDraft(),
    });
    await runOrderFormSave(ports);
    expect(calls).toEqual([]);
    expect(getFieldErrors().customer).toBe("required");
    expect(getFieldErrors().items).toBe("required");
  });
});
