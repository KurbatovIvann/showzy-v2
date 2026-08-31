import { describe, expect, it } from "vitest";

import {
  IDLE_DETAIL_SHEETS,
  productDetailSheetChrome,
  reduceProductDetailSheets,
  sheetsAfterCloseVariantEditor,
  sheetsOpenNewVariant,
  sheetsOpenProductActions,
  sheetsOpenVariantActions,
} from "./product-detail.reducer";

const VARIANT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_VARIANT_ID = "22222222-2222-4222-8222-222222222222";

describe("reduceProductDetailSheets", () => {
  it("opens and closes the product ⋯ sheet", () => {
    const open = reduceProductDetailSheets(IDLE_DETAIL_SHEETS, {
      type: "openProductActions",
    });
    expect(open).toEqual(sheetsOpenProductActions());
    expect(productDetailSheetChrome(open).productActionsVisible).toBe(true);
    expect(reduceProductDetailSheets(open, { type: "closeAll" })).toEqual(
      IDLE_DETAIL_SHEETS,
    );
  });

  it("opens and closes the variant ⋯ sheet", () => {
    const open = reduceProductDetailSheets(IDLE_DETAIL_SHEETS, {
      type: "openVariantActions",
      variantId: VARIANT_ID,
      name: "",
      archived: false,
    });
    expect(open).toEqual(sheetsOpenVariantActions(VARIANT_ID));
    expect(productDetailSheetChrome(open).variantActionsVisible).toBe(true);
    expect(productDetailSheetChrome(open).variantEditorVisible).toBe(false);
    expect(reduceProductDetailSheets(open, { type: "closeAll" })).toEqual(
      IDLE_DETAIL_SHEETS,
    );
  });

  it("keeps product ⋯, variant ⋯, and the new-variant editor mutually exclusive", () => {
    const variantOpen = reduceProductDetailSheets(IDLE_DETAIL_SHEETS, {
      type: "openVariantActions",
      variantId: VARIANT_ID,
      name: "",
      archived: false,
    });
    expect(
      reduceProductDetailSheets(variantOpen, { type: "openProductActions" }),
    ).toEqual(sheetsOpenProductActions());

    const productOpen = sheetsOpenProductActions();
    expect(
      reduceProductDetailSheets(productOpen, {
        type: "openVariantActions",
        variantId: VARIANT_ID,
        name: "",
        archived: false,
      }),
    ).toEqual(sheetsOpenVariantActions(VARIANT_ID));
    expect(
      reduceProductDetailSheets(productOpen, { type: "openNewVariant" }),
    ).toEqual(sheetsOpenNewVariant());
    expect(
      productDetailSheetChrome(sheetsOpenNewVariant()).variantActionsVisible,
    ).toBe(false);
    expect(
      productDetailSheetChrome(sheetsOpenNewVariant()).productActionsVisible,
    ).toBe(false);
    expect(
      productDetailSheetChrome(sheetsOpenNewVariant()).variantEditorVisible,
    ).toBe(true);
  });

  it("hides variant ⋯ while the editor is open and restores ⋯ after close", () => {
    const editing = reduceProductDetailSheets(
      sheetsOpenVariantActions(VARIANT_ID),
      { type: "openVariantEditor", variantId: VARIANT_ID },
    );
    expect(editing).toEqual({
      productActions: false,
      variantActionId: VARIANT_ID,
      variantActionName: "",
      variantActionArchived: false,
      variantEditor: { mode: "edit", variantId: VARIANT_ID },
    });
    expect(productDetailSheetChrome(editing).variantActionsVisible).toBe(false);
    expect(productDetailSheetChrome(editing).variantEditorVisible).toBe(true);
    expect(sheetsAfterCloseVariantEditor(editing)).toEqual(
      sheetsOpenVariantActions(VARIANT_ID),
    );
    expect(sheetsAfterCloseVariantEditor(sheetsOpenNewVariant())).toEqual(
      IDLE_DETAIL_SHEETS,
    );
  });

  it("restores variant ⋯ after a cancelled variant confirm and stays idle after a cancelled product confirm", () => {
    expect(
      reduceProductDetailSheets(IDLE_DETAIL_SHEETS, {
        type: "cancelStatusConfirm",
        restore: "variantActions",
        variantActionId: VARIANT_ID,
        variantActionName: "",
        variantActionArchived: false,
      }),
    ).toEqual(sheetsOpenVariantActions(VARIANT_ID));
    expect(
      reduceProductDetailSheets(IDLE_DETAIL_SHEETS, {
        type: "cancelStatusConfirm",
        restore: "idle",
        variantActionId: null,
        variantActionName: "",
        variantActionArchived: false,
      }),
    ).toEqual(IDLE_DETAIL_SHEETS);
    expect(
      reduceProductDetailSheets(sheetsOpenProductActions(), {
        type: "cancelStatusConfirm",
        restore: "variantActions",
        variantActionId: null,
        variantActionName: "",
        variantActionArchived: false,
      }),
    ).toEqual(IDLE_DETAIL_SHEETS);
  });

  it("does not keep a stale variant id when opening a different variant", () => {
    const first = sheetsOpenVariantActions(VARIANT_ID);
    expect(
      reduceProductDetailSheets(first, {
        type: "openVariantActions",
        variantId: OTHER_VARIANT_ID,
        name: "",
        archived: false,
      }),
    ).toEqual(sheetsOpenVariantActions(OTHER_VARIANT_ID));
  });

  it("captures variant name and archived at open and restores them after cancel", () => {
    const open = reduceProductDetailSheets(IDLE_DETAIL_SHEETS, {
      type: "openVariantActions",
      variantId: VARIANT_ID,
      name: "1 кг",
      archived: true,
    });
    expect(open).toEqual(
      sheetsOpenVariantActions(VARIANT_ID, { name: "1 кг", archived: true }),
    );
    const editing = reduceProductDetailSheets(open, {
      type: "openVariantEditor",
      variantId: VARIANT_ID,
    });
    expect(editing.variantActionName).toBe("1 кг");
    expect(editing.variantActionArchived).toBe(true);
    expect(sheetsAfterCloseVariantEditor(editing)).toEqual(
      sheetsOpenVariantActions(VARIANT_ID, { name: "1 кг", archived: true }),
    );
    expect(
      reduceProductDetailSheets(IDLE_DETAIL_SHEETS, {
        type: "cancelStatusConfirm",
        restore: "variantActions",
        variantActionId: VARIANT_ID,
        variantActionName: "1 кг",
        variantActionArchived: true,
      }),
    ).toEqual(
      sheetsOpenVariantActions(VARIANT_ID, { name: "1 кг", archived: true }),
    );
  });
});
