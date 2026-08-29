import { describe, expect, it } from "vitest";

import { addOrderLine, emptyOrderFormDraft } from "./order-form-draft";
import {
  commitProductPickerPicks,
  emptyProductPicker,
  productPickerOpen,
  productPickerPicks,
  productPickerSelectedIds,
  productPickerSelectedVariantIds,
  productPickerSelectedVariantNames,
  productPickerVariantPicksForProduct,
  reduceProductPicker,
  type ProductPickerState,
} from "./product-picker";

const PRODUCT_A = "33333333-3333-4333-8333-333333333333";
const PRODUCT_B = "55555555-5555-4555-8555-555555555555";
const VARIANT_1 = "44444444-4444-4444-8444-444444444444";
const VARIANT_2 = "66666666-6666-4666-8666-666666666666";

function openPicker(): ProductPickerState {
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
    expect(productPickerSelectedIds(productPickerPicks(state)).has(PRODUCT_A)).toBe(
      true,
    );
    state = reduceProductPicker(state, {
      type: "toggleSimple",
      productId: PRODUCT_A,
      productName: "Торт",
    });
    expect(state.kind).toBe("products");
    expect(productPickerOpen(state)).toBe(true);
    expect(productPickerPicks(state)).toEqual([]);
  });

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
    const draftItems = seeded.draft.items;
    let state = openPicker();
    state = reduceProductPicker(state, {
      type: "toggleSimple",
      productId: PRODUCT_B,
      productName: "Кенді-бар",
    });
    expect(productPickerPicks(state)).toHaveLength(1);
    state = reduceProductPicker(state, { type: "close" });
    expect(state).toEqual({ kind: "closed" });
    expect(productPickerPicks(state)).toEqual([]);
    expect(seeded.draft.items).toBe(draftItems);
    expect(seeded.draft.items).toEqual([
      {
        key: "draft-1",
        productId: PRODUCT_A,
        variantId: null,
        productName: "Торт",
        variantName: null,
        quantityMilli: "1000",
      },
    ]);
  });

  it("drills into variants in the same session without discarding product picks", () => {
    let state = openPicker();
    state = reduceProductPicker(state, {
      type: "toggleSimple",
      productId: PRODUCT_B,
      productName: "Кенді-бар",
    });
    state = reduceProductPicker(state, {
      type: "openVariants",
      productId: PRODUCT_A,
      productName: "Торт",
    });
    expect(state.kind).toBe("variants");
    expect(productPickerOpen(state)).toBe(true);
    expect(productPickerPicks(state)).toEqual([
      {
        productId: PRODUCT_B,
        variantId: null,
        productName: "Кенді-бар",
        variantName: null,
      },
    ]);
  });

  it("multi-toggles variants without leaving the drill-down", () => {
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
    expect(state.kind).toBe("variants");
    expect(productPickerOpen(state)).toBe(true);
    expect([...productPickerSelectedVariantIds(state)]).toEqual([VARIANT_1]);
    state = reduceProductPicker(state, {
      type: "pickVariant",
      variantId: VARIANT_2,
      variantName: "2 кг",
    });
    expect(state.kind).toBe("variants");
    expect(productPickerSelectedVariantIds(state).size).toBe(2);
    state = reduceProductPicker(state, {
      type: "pickVariant",
      variantId: VARIANT_1,
      variantName: "1 кг",
    });
    expect(state.kind).toBe("variants");
    expect([...productPickerSelectedVariantIds(state)]).toEqual([VARIANT_2]);
  });

  it("appends two variants of A plus one simple B on Готово (footer N is 3)", () => {
    let state = openPicker();
    state = reduceProductPicker(state, {
      type: "toggleSimple",
      productId: PRODUCT_B,
      productName: "Кенді-бар",
    });
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
    expect(productPickerPicks(state)).toHaveLength(3);
    const committed = commitProductPickerPicks(
      emptyOrderFormDraft(),
      productPickerPicks(state),
    );
    expect(committed.rejected).toBeNull();
    expect(committed.lines).toHaveLength(3);
    expect(
      committed.draft.items.map((item) => item.variantId ?? item.productId),
    ).toEqual([PRODUCT_B, VARIANT_1, VARIANT_2]);
  });

  it("keeps variant picks on back and marks the parent product selected", () => {
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
    state = reduceProductPicker(state, { type: "closeVariants" });
    expect(state.kind).toBe("products");
    expect(productPickerOpen(state)).toBe(true);
    expect(productPickerPicks(state)).toHaveLength(2);
    expect(
      productPickerSelectedIds(productPickerPicks(state)).has(PRODUCT_A),
    ).toBe(true);
    expect(
      productPickerVariantPicksForProduct(productPickerPicks(state), PRODUCT_A),
    ).toHaveLength(2);
    expect(
      productPickerSelectedVariantNames(productPickerPicks(state), PRODUCT_A),
    ).toEqual(["1 кг", "2 кг"]);
  });

  it("marks a picked variant as selected when the drill-down reopens", () => {
    let state = openPicker();
    state = reduceProductPicker(state, {
      type: "openVariants",
      productId: PRODUCT_A,
      productName: "Торт",
    });
    expect(productPickerSelectedVariantIds(state).size).toBe(0);
    state = reduceProductPicker(state, {
      type: "pickVariant",
      variantId: VARIANT_1,
      variantName: "1 кг",
    });
    expect(state.kind).toBe("variants");
    expect([...productPickerSelectedVariantIds(state)]).toEqual([VARIANT_1]);
    state = reduceProductPicker(state, { type: "closeVariants" });
    expect(state.kind).toBe("products");
    state = reduceProductPicker(state, {
      type: "openVariants",
      productId: PRODUCT_A,
      productName: "Торт",
    });
    expect(state.kind).toBe("variants");
    expect(productPickerOpen(state)).toBe(true);
    expect([...productPickerSelectedVariantIds(state)]).toEqual([VARIANT_1]);
    state = reduceProductPicker(state, {
      type: "pickVariant",
      variantId: VARIANT_1,
      variantName: "1 кг",
    });
    expect(state.kind).toBe("variants");
    expect(productPickerPicks(state)).toEqual([]);
    state = reduceProductPicker(state, { type: "closeVariants" });
    state = reduceProductPicker(state, {
      type: "openVariants",
      productId: PRODUCT_A,
      productName: "Торт",
    });
    expect(productPickerSelectedVariantIds(state).size).toBe(0);
  });

  it("keeps the product-sheet session open while drilling into variants", () => {
    let state = openPicker();
    expect(productPickerOpen(state)).toBe(true);
    state = reduceProductPicker(state, {
      type: "openVariants",
      productId: PRODUCT_A,
      productName: "Торт",
    });
    expect(state.kind).toBe("variants");
    expect(productPickerOpen(state)).toBe(true);
    state = reduceProductPicker(state, { type: "closeVariants" });
    expect(state.kind).toBe("products");
    expect(productPickerOpen(state)).toBe(true);
    state = reduceProductPicker(state, { type: "close" });
    expect(productPickerOpen(state)).toBe(false);
  });

  it("keeps the selection set when the variant list is closed without a pick", () => {
    let state = openPicker();
    state = reduceProductPicker(state, {
      type: "toggleSimple",
      productId: PRODUCT_B,
      productName: "Кенді-бар",
    });
    state = reduceProductPicker(state, {
      type: "openVariants",
      productId: PRODUCT_A,
      productName: "Торт",
    });
    state = reduceProductPicker(state, { type: "closeVariants" });
    expect(state.kind).toBe("products");
    expect(productPickerPicks(state)).toHaveLength(1);
    expect(productPickerPicks(state)[0]?.productId).toBe(PRODUCT_B);
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

  it("discards variant picks when X closes the sheet without Готово", () => {
    const origin = emptyOrderFormDraft();
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
    expect(productPickerPicks(state)).toHaveLength(1);
    state = reduceProductPicker(state, { type: "close" });
    expect(state.kind).toBe("closed");
    expect(productPickerPicks(state)).toEqual([]);
    expect(origin.items).toEqual([]);
  });

  it("rejects a duplicate product/variant already on the form draft", () => {
    const first = commitProductPickerPicks(emptyOrderFormDraft(), [
      {
        productId: PRODUCT_A,
        variantId: VARIANT_1,
        productName: "Торт",
        variantName: "1 кг",
      },
    ]);
    expect(first.lines).toHaveLength(1);
    const duplicate = commitProductPickerPicks(first.draft, [
      {
        productId: PRODUCT_A,
        variantId: VARIANT_1,
        productName: "Торт",
        variantName: "1 кг",
      },
    ]);
    expect(duplicate.rejected).toBe("duplicate");
    expect(duplicate.lines).toHaveLength(0);
    expect(duplicate.draft.items).toHaveLength(1);
  });
});
