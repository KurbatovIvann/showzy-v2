import { describe, expect, it } from "vitest";

import { MAX_LINE_QUANTITY_UNITS } from "../shared/order-caps";
import {
  addOrderLine,
  emptyOrderFormDraft,
  formatOrderLineQuantity,
  parseOrderFormUiDraft,
  quantityMilliFromUnits,
  removeOrderLine,
  stepQuantityMilli,
  unitsFromQuantityMilli,
  validateOrderForm,
  type OrderFormDraft,
} from "./order-form-draft";

const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_A = "33333333-3333-4333-8333-333333333333";
const PRODUCT_B = "55555555-5555-4555-8555-555555555555";

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

  it("rounds half-up so 1500 milli is 2 units, not a truncated 1", () => {
    expect(unitsFromQuantityMilli("1500")).toBe(2);
    expect(unitsFromQuantityMilli("1499")).toBe(1);
    expect(formatOrderLineQuantity("1500")).toBe("2");
    expect(stepQuantityMilli("1500", 1)).toBe("3000");
  });

  it("clamps the stepper at the max whole-unit ceiling", () => {
    const maxMilli = quantityMilliFromUnits(MAX_LINE_QUANTITY_UNITS);
    expect(unitsFromQuantityMilli(maxMilli)).toBe(MAX_LINE_QUANTITY_UNITS);
    expect(stepQuantityMilli(maxMilli, 1)).toBe(maxMilli);
    expect(quantityMilliFromUnits(MAX_LINE_QUANTITY_UNITS + 1)).toBe(maxMilli);
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
    expect(added.draft.items).toHaveLength(1);
    const duplicate = addOrderLine(added.draft, {
      productId: PRODUCT_A,
      variantId: null,
      productName: "Торт",
      variantName: null,
    });
    expect(duplicate).toEqual({ ok: false, reason: "duplicate" });
    const second = addOrderLine(added.draft, {
      productId: PRODUCT_B,
      variantId: null,
      productName: "Кенді-бар",
      variantName: null,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(removeOrderLine(second.draft, "draft-1").items).toHaveLength(1);
  });
});

describe("validateOrderForm", () => {
  it("requires a customer and at least one item", () => {
    expect(validateOrderForm(emptyOrderFormDraft())).toEqual({
      customer: "required",
      items: "required",
      comment: null,
    });
    expect(parseOrderFormUiDraft(validDraft()).ok).toBe(true);
  });
});
