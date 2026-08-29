import { describe, expect, it } from "vitest";

import { emptyOrderFormDraft, type OrderFormDraft } from "./order-form-draft";
import {
  createOrderPayload,
  parseThenPlanOrderFormSave,
  planOrderFormSave,
  type OrderFormWrite,
} from "./order-form-plan";

const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
const VARIANT_ID = "44444444-4444-4444-8444-444444444444";

function validDraft(overrides: Partial<OrderFormDraft> = {}): OrderFormDraft {
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
        quantityMilli: "2000",
      },
    ],
    ...overrides,
  };
}

describe("createOrderPayload", () => {
  it("emits wire { customerId, items } only — no prices, payment, or delivery", () => {
    const payload = createOrderPayload(validDraft());
    expect(payload).toEqual({
      customerId: CUSTOMER_ID,
      items: [{ productId: PRODUCT_ID, quantityMilli: "2000" }],
    });
    expect(Object.keys(payload ?? {}).sort()).toEqual(["customerId", "items"]);
    expect(Object.keys(payload?.items[0] ?? {}).sort()).toEqual([
      "productId",
      "quantityMilli",
    ]);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("basePrice");
    expect(serialized).not.toContain("unitPrice");
    expect(serialized).not.toContain("payment");
    expect(serialized).not.toContain("delivery");
    expect(serialized).not.toContain("dueDate");
    expect(serialized).not.toContain("status");
    expect(serialized).not.toContain("discount");
    expect(serialized).not.toContain("customerName");
    expect(serialized).not.toContain("productName");
  });

  it("includes optional variantId and trimmed comment only when set", () => {
    const withVariant = createOrderPayload(
      validDraft({
        comment: "  Без горіхів  ",
        items: [
          {
            key: "draft-1",
            productId: PRODUCT_ID,
            variantId: VARIANT_ID,
            productName: "Торт",
            variantName: "1 кг",
            quantityMilli: "1000",
          },
        ],
      }),
    );
    expect(withVariant).toEqual({
      customerId: CUSTOMER_ID,
      items: [
        {
          productId: PRODUCT_ID,
          variantId: VARIANT_ID,
          quantityMilli: "1000",
        },
      ],
      comment: "Без горіхів",
    });
    expect(Object.keys(withVariant ?? {}).sort()).toEqual([
      "comment",
      "customerId",
      "items",
    ]);
    expect(Object.keys(withVariant?.items[0] ?? {}).sort()).toEqual([
      "productId",
      "quantityMilli",
      "variantId",
    ]);
    expect(createOrderPayload(validDraft({ comment: "   " }))).toEqual({
      customerId: CUSTOMER_ID,
      items: [{ productId: PRODUCT_ID, quantityMilli: "2000" }],
    });
  });
});

describe("planOrderFormSave", () => {
  it("submits create and retries the same attempt after a network failure", () => {
    const first = planOrderFormSave({
      draft: validDraft(),
      lastWrite: null,
      lastFailureKind: null,
    });
    expect(first.kind).toBe("write");
    if (first.kind !== "write") {
      return;
    }
    expect(first.write.kind).toBe("createOrder");
    expect(
      planOrderFormSave({
        draft: validDraft(),
        lastWrite: first.write,
        lastFailureKind: "network",
      }),
    ).toEqual({ kind: "retry" });
  });

  it("stays invalid without calling transport", () => {
    expect(
      planOrderFormSave({
        draft: emptyOrderFormDraft(),
        lastWrite: null,
        lastFailureKind: null,
      }).kind,
    ).toBe("invalid");
    expect(
      parseThenPlanOrderFormSave({
        draft: emptyOrderFormDraft(),
        lastWrite: null,
        lastFailureKind: null,
      }).kind,
    ).toBe("invalid");
  });

  it("does not retry a different payload", () => {
    const lastWrite: OrderFormWrite = {
      kind: "createOrder",
      input: {
        customerId: CUSTOMER_ID,
        items: [{ productId: PRODUCT_ID, quantityMilli: "1000" }],
      },
    };
    const planned = planOrderFormSave({
      draft: validDraft(),
      lastWrite,
      lastFailureKind: "network",
    });
    expect(planned.kind).toBe("write");
  });
});
