import { describe, expect, it } from "vitest";

import { CREATE_ORDER_MAX_ITEMS } from "../shared/order-caps";
import {
  addOrderLine,
  emptyOrderFormDraft,
  formatOrderLineQuantity,
  isOrderFormDirty,
  parseOrderFormUiDraft,
  quantityMilliFromUnits,
  removeOrderLine,
  setOrderLineQuantity,
  stepQuantityMilli,
  unitsFromQuantityMilli,
  validateOrderForm,
  type OrderFormDraft,
} from "./order-form-draft";

const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_A = "33333333-3333-4333-8333-333333333333";
const PRODUCT_B = "55555555-5555-4555-8555-555555555555";
const VARIANT_ID = "44444444-4444-4444-8444-444444444444";

function validDraft(): OrderFormDraft {
  return {
    customerId: CUSTOMER_ID,
    customerName: "Марія",
    comment: "",
    nextDraftSerial: 2,
    items: [
      {
        key: "draft-1",
        productId: PRODUCT_A,
        variantId: null,
        productName: "Торт",
        variantName: null,
        quantityMilli: "1000",
      },
    ],
  };
}

describe("quantity milli stepper", () => {
  it("starts at one unit and steps by whole units", () => {
    expect(quantityMilliFromUnits(1)).toBe("1000");
    expect(quantityMilliFromUnits(2)).toBe("2000");
    expect(unitsFromQuantityMilli("1000")).toBe(1);
    expect(stepQuantityMilli("1000", 1)).toBe("2000");
    expect(stepQuantityMilli("1000", -1)).toBe("1000");
    expect(formatOrderLineQuantity("3000")).toBe("3");
  });
});

describe("addOrderLine / removeOrderLine", () => {
  it("appends a line and rejects a duplicate product/variant", () => {
    const added = addOrderLine(emptyOrderFormDraft(), {
      productId: PRODUCT_A,
      variantId: null,
      productName: "Торт",
      variantName: null,
    });
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }
    expect(added.line.quantityMilli).toBe("1000");
    expect(
      addOrderLine(added.draft, {
        productId: PRODUCT_A,
        variantId: null,
        productName: "Торт",
        variantName: null,
      }),
    ).toEqual({ ok: false, reason: "duplicate" });
    expect(
      addOrderLine(added.draft, {
        productId: PRODUCT_A,
        variantId: VARIANT_ID,
        productName: "Торт",
        variantName: "1 кг",
      }).ok,
    ).toBe(true);
  });

  it("rejects a 101st line", () => {
    let draft = emptyOrderFormDraft();
    for (let index = 0; index < CREATE_ORDER_MAX_ITEMS; index += 1) {
      const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
      const added = addOrderLine(draft, {
        productId: id,
        variantId: null,
        productName: "Row",
        variantName: null,
      });
      expect(added.ok).toBe(true);
      if (!added.ok) {
        return;
      }
      draft = added.draft;
    }
    expect(
      addOrderLine(draft, {
        productId: PRODUCT_B,
        variantId: null,
        productName: "Extra",
        variantName: null,
      }),
    ).toEqual({ ok: false, reason: "too_many" });
  });

  it("removes a line and updates quantity", () => {
    const draft = validDraft();
    const next = setOrderLineQuantity(draft, "draft-1", "2000");
    expect(next.items[0]?.quantityMilli).toBe("2000");
    expect(removeOrderLine(next, "draft-1").items).toEqual([]);
  });
});

describe("isOrderFormDirty", () => {
  it("is clean against the origin and dirty after customer, line, or comment", () => {
    const origin = emptyOrderFormDraft();
    expect(isOrderFormDirty(origin, origin)).toBe(false);
    expect(isOrderFormDirty(validDraft(), origin)).toBe(true);
    expect(isOrderFormDirty({ ...origin, comment: "Нотатка" }, origin)).toBe(
      true,
    );
  });
});

describe("parseOrderFormUiDraft", () => {
  it("accepts a customer plus one line and rejects an empty draft", () => {
    expect(parseOrderFormUiDraft(validDraft()).ok).toBe(true);
    expect(parseOrderFormUiDraft(emptyOrderFormDraft()).ok).toBe(false);
    expect(validateOrderForm(emptyOrderFormDraft()).customer).toBe("required");
    expect(validateOrderForm(emptyOrderFormDraft()).items).toBe("required");
  });
});
