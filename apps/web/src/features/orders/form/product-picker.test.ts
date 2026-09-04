import { describe, expect, it } from "vitest";

import { addOrderLine, emptyOrderFormDraft } from "./order-form-draft";
import {
  commitProductPickerPicks,
  emptyProductPicker,
  isIdentityBlockedOnOrder,
  lineIdentityKeySet,
  productPickerOpen,
  productPickerPicks,
  productPickerSelectedIds,
  productPickerSelectedVariantIds,
  reduceProductPicker,
} from "./product-picker";

const PRODUCT_A = "33333333-3333-4333-8333-333333333333";
const PRODUCT_B = "55555555-5555-4555-8555-555555555555";
const VARIANT_1 = "44444444-4444-4444-8444-444444444444";
const VARIANT_2 = "66666666-6666-4666-8666-666666666666";

function openPicker() {
  return reduceProductPicker(emptyProductPicker(), { type: "open" });
}

describe("reduceProductPicker", () => {
  it("toggles a simple product on, off, and keeps the sheet session open", () => {
    let state = openPicker();
    state = reduceProductPicker(state, {
      type: "toggleSimple",
      productId: PRODUCT_A,
      productName: "Торт",
    });
    expect(state.kind).toBe("products");
    expect(productPickerOpen(state)).toBe(true);
    expect(productPickerPicks(state)).toHaveLength(1);
    expect(
      productPickerSelectedIds(productPickerPicks(state)).has(PRODUCT_A),
    ).toBe(true);
    state = reduceProductPicker(state, {
      type: "toggleSimple",
      productId: PRODUCT_A,
      productName: "Торт",
    });
    expect(productPickerPicks(state)).toEqual([]);
  });

  it("discards the in-sheet draft when closing without Готово", () => {
    const seeded = addOrderLine(emptyOrderFormDraft(), {
      productId: PRODUCT_A,
      variantId: null,
      productName: "Торт",
      variantName: null,
    });
    expect(seeded.ok).toBe(true);
    if (!seeded.ok) {
      return;
    }
    let state = openPicker();
    state = reduceProductPicker(state, {
      type: "toggleSimple",
      productId: PRODUCT_B,
      productName: "Кенді-бар",
    });
    state = reduceProductPicker(state, { type: "close" });
    expect(state).toEqual({ kind: "closed" });
    expect(seeded.draft.items).toHaveLength(1);
  });

  it("multi-toggles variants without leaving the drill-down, then commits", () => {
    let state = openPicker();
    state = reduceProductPicker(state, {
      type: "openVariants",
      productId: PRODUCT_A,
      productName: "Торт",
    });
    state = reduceProductPicker(state, {
      type: "pickVariant",
      variantId: VARIANT_1,
      variantName: "1 кг",
    });
    state = reduceProductPicker(state, {
      type: "pickVariant",
      variantId: VARIANT_2,
      variantName: "2 кг",
    });
    expect(state.kind).toBe("variants");
    expect(productPickerSelectedVariantIds(state).size).toBe(2);
    const committed = commitProductPickerPicks(
      emptyOrderFormDraft(),
      productPickerPicks(state),
    );
    expect(committed.rejected).toBeNull();
    expect(committed.lines).toHaveLength(2);
  });
});

describe("isIdentityBlockedOnOrder", () => {
  it("blocks a simple product already on the order unless it is in this draft", () => {
    const existing = lineIdentityKeySet([
      { productId: PRODUCT_A, variantId: null },
    ]);
    expect(isIdentityBlockedOnOrder(existing, PRODUCT_A, null, [])).toBe(true);
    expect(isIdentityBlockedOnOrder(existing, PRODUCT_B, null, [])).toBe(false);
    const draft = productPickerPicks(
      reduceProductPicker(openPicker(), {
        type: "toggleSimple",
        productId: PRODUCT_A,
        productName: "Торт",
      }),
    );
    expect(isIdentityBlockedOnOrder(existing, PRODUCT_A, null, draft)).toBe(
      false,
    );
  });
});
