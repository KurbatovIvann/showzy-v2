import { describe, expect, it } from "vitest";

import { emptyOrderFormDraft } from "./order-form-draft";
import {
  commitProductPickerPicks,
  emptyProductPicker,
  productPickerOpen,
  productPickerPicks,
  productPickerSelectedIds,
  reduceProductPicker,
  type ProductPickerState,
} from "./product-picker";

const PRODUCT_A = "33333333-3333-4333-8333-333333333333";
const PRODUCT_B = "55555555-5555-4555-8555-555555555555";
const VARIANT_ID = "44444444-4444-4444-8444-444444444444";

function openPicker(): ProductPickerState {
  return reduceProductPicker(emptyProductPicker(), { type: "open" });
}

describe("reduceProductPicker", () => {
  it("toggles two products without closing and Готово commits both lines", () => {
    let state = openPicker();
    state = reduceProductPicker(state, {
      type: "toggleSimple",
      productId: PRODUCT_A,
      productName: "Торт",
    });
    expect(state.kind).toBe("products");
    state = reduceProductPicker(state, {
      type: "toggleSimple",
      productId: PRODUCT_B,
      productName: "Кенді-бар",
    });
    expect(state.kind).toBe("products");
    expect(productPickerOpen(state)).toBe(true);
    expect(productPickerPicks(state)).toHaveLength(2);
    expect(
      [...productPickerSelectedIds(productPickerPicks(state))].sort(),
    ).toEqual([PRODUCT_A, PRODUCT_B].sort());
    const committed = commitProductPickerPicks(
      emptyOrderFormDraft(),
      productPickerPicks(state),
    );
    expect(committed.rejected).toBeNull();
    expect(committed.lines).toHaveLength(2);
    expect(committed.draft.items.map((item) => item.productId)).toEqual([
      PRODUCT_A,
      PRODUCT_B,
    ]);
  });

  it("discards the in-sheet draft when closing without Готово", () => {
    let state = openPicker();
    state = reduceProductPicker(state, {
      type: "toggleSimple",
      productId: PRODUCT_A,
      productName: "Торт",
    });
    state = reduceProductPicker(state, { type: "close" });
    expect(state).toEqual({ kind: "closed" });
    expect(productPickerPicks(state)).toEqual([]);
    expect(emptyOrderFormDraft().items).toEqual([]);
  });

  it("returns to the product sheet after a variant pick without losing other picks", () => {
    let state = openPicker();
    state = reduceProductPicker(state, {
      type: "toggleSimple",
      productId: PRODUCT_A,
      productName: "Торт",
    });
    state = reduceProductPicker(state, {
      type: "openVariants",
      productId: PRODUCT_B,
      productName: "Букет",
    });
    expect(state.kind).toBe("variants");
    if (state.kind !== "variants") {
      return;
    }
    expect(state.picks).toHaveLength(1);
    expect(state.picks[0]?.productId).toBe(PRODUCT_A);
    state = reduceProductPicker(state, {
      type: "pickVariant",
      variantId: VARIANT_ID,
      variantName: "1 кг",
    });
    expect(state.kind).toBe("products");
    expect(productPickerPicks(state)).toEqual([
      {
        productId: PRODUCT_A,
        variantId: null,
        productName: "Торт",
        variantName: null,
      },
      {
        productId: PRODUCT_B,
        variantId: VARIANT_ID,
        productName: "Букет",
        variantName: "1 кг",
      },
    ]);
  });

  it("keeps the selection set when the variant sheet is closed without a pick", () => {
    let state = openPicker();
    state = reduceProductPicker(state, {
      type: "toggleSimple",
      productId: PRODUCT_A,
      productName: "Торт",
    });
    state = reduceProductPicker(state, {
      type: "openVariants",
      productId: PRODUCT_B,
      productName: "Букет",
    });
    state = reduceProductPicker(state, { type: "closeVariants" });
    expect(state.kind).toBe("products");
    expect(productPickerPicks(state)).toHaveLength(1);
    expect(productPickerPicks(state)[0]?.productId).toBe(PRODUCT_A);
  });

  it("toggles a simple product off and rejects a duplicate already on the draft", () => {
    let state = openPicker();
    state = reduceProductPicker(state, {
      type: "toggleSimple",
      productId: PRODUCT_A,
      productName: "Торт",
    });
    state = reduceProductPicker(state, {
      type: "toggleSimple",
      productId: PRODUCT_A,
      productName: "Торт",
    });
    expect(productPickerPicks(state)).toEqual([]);
    const first = commitProductPickerPicks(emptyOrderFormDraft(), [
      {
        productId: PRODUCT_A,
        variantId: null,
        productName: "Торт",
        variantName: null,
      },
    ]);
    expect(first.lines).toHaveLength(1);
    const duplicate = commitProductPickerPicks(first.draft, [
      {
        productId: PRODUCT_A,
        variantId: null,
        productName: "Торт",
        variantName: null,
      },
      {
        productId: PRODUCT_B,
        variantId: null,
        productName: "Кенді-бар",
        variantName: null,
      },
    ]);
    expect(duplicate.rejected).toBe("duplicate");
    expect(duplicate.lines).toHaveLength(1);
    expect(duplicate.draft.items.map((item) => item.productId)).toEqual([
      PRODUCT_A,
      PRODUCT_B,
    ]);
  });
});
