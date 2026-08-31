/**
 * Product-detail sheet chrome (SHO-160). Local reducer, not XState:
 * product ⋯, variant ⋯, and the variant editor are mutually exclusive
 * except edit-mode, which keeps the variant id so close restores ⋯.
 *
 * Variant ⋯ chrome (`name` / `archived`) is captured at open time
 * (SHO-302). Do not write a render-phase ref for the last selected row.
 */
export type VariantActionChrome = {
  readonly id: string;
  readonly name: string;
  readonly archived: boolean;
};

export type DetailSheets = {
  readonly productActions: boolean;
  readonly variantActionId: string | null;
  readonly variantActionName: string;
  readonly variantActionArchived: boolean;
  readonly variantEditor:
    | { readonly mode: "new" }
    | { readonly mode: "edit"; readonly variantId: string }
    | null;
};

export const IDLE_DETAIL_SHEETS: DetailSheets = {
  productActions: false,
  variantActionId: null,
  variantActionName: "",
  variantActionArchived: false,
  variantEditor: null,
};

export type ProductDetailSheetAction =
  | { readonly type: "openProductActions" }
  | {
      readonly type: "openVariantActions";
      readonly variantId: string;
      readonly name: string;
      readonly archived: boolean;
    }
  | { readonly type: "openNewVariant" }
  | { readonly type: "openVariantEditor"; readonly variantId: string }
  | { readonly type: "closeVariantEditor" }
  | { readonly type: "closeAll" }
  | {
      readonly type: "cancelStatusConfirm";
      readonly restore: "idle" | "variantActions";
      readonly variantActionId: string | null;
      readonly variantActionName: string;
      readonly variantActionArchived: boolean;
    };

export function reduceProductDetailSheets(
  state: DetailSheets,
  action: ProductDetailSheetAction,
): DetailSheets {
  switch (action.type) {
    case "openProductActions":
      return { ...IDLE_DETAIL_SHEETS, productActions: true };
    case "openVariantActions":
      return {
        ...IDLE_DETAIL_SHEETS,
        variantActionId: action.variantId,
        variantActionName: action.name,
        variantActionArchived: action.archived,
      };
    case "openNewVariant":
      return { ...IDLE_DETAIL_SHEETS, variantEditor: { mode: "new" } };
    case "openVariantEditor":
      return {
        productActions: false,
        variantActionId: action.variantId,
        variantActionName: state.variantActionName,
        variantActionArchived: state.variantActionArchived,
        variantEditor: { mode: "edit", variantId: action.variantId },
      };
    case "closeVariantEditor": {
      const editor = state.variantEditor;
      if (editor !== null && editor.mode === "edit") {
        return {
          ...IDLE_DETAIL_SHEETS,
          variantActionId: editor.variantId,
          variantActionName: state.variantActionName,
          variantActionArchived: state.variantActionArchived,
        };
      }
      return IDLE_DETAIL_SHEETS;
    }
    case "closeAll":
      return IDLE_DETAIL_SHEETS;
    case "cancelStatusConfirm":
      if (
        action.restore === "variantActions" &&
        action.variantActionId !== null
      ) {
        return {
          ...IDLE_DETAIL_SHEETS,
          variantActionId: action.variantActionId,
          variantActionName: action.variantActionName,
          variantActionArchived: action.variantActionArchived,
        };
      }
      return IDLE_DETAIL_SHEETS;
  }
}

export function sheetsOpenProductActions(): DetailSheets {
  return reduceProductDetailSheets(IDLE_DETAIL_SHEETS, {
    type: "openProductActions",
  });
}

export function sheetsOpenVariantActions(
  variantId: string,
  chrome: { readonly name?: string; readonly archived?: boolean } = {},
): DetailSheets {
  return reduceProductDetailSheets(IDLE_DETAIL_SHEETS, {
    type: "openVariantActions",
    variantId,
    name: chrome.name ?? "",
    archived: chrome.archived ?? false,
  });
}

export function sheetsOpenNewVariant(): DetailSheets {
  return reduceProductDetailSheets(IDLE_DETAIL_SHEETS, {
    type: "openNewVariant",
  });
}

export function sheetsAfterProductSheetAction(): DetailSheets {
  return reduceProductDetailSheets(IDLE_DETAIL_SHEETS, { type: "closeAll" });
}

export function sheetsAfterVariantSheetAction(args: {
  readonly variantId: string;
  readonly result: { readonly kind: "editor" } | { readonly kind: "confirm" };
}): DetailSheets {
  if (args.result.kind === "editor") {
    return reduceProductDetailSheets(IDLE_DETAIL_SHEETS, {
      type: "openVariantEditor",
      variantId: args.variantId,
    });
  }
  return IDLE_DETAIL_SHEETS;
}

export function sheetsAfterCloseVariantEditor(
  sheets: DetailSheets,
): DetailSheets {
  return reduceProductDetailSheets(sheets, { type: "closeVariantEditor" });
}

export function productDetailSheetChrome(sheets: DetailSheets): {
  readonly productActionsVisible: boolean;
  readonly variantActionsVisible: boolean;
  readonly variantEditorVisible: boolean;
  readonly variantEditorMode: "new" | "edit";
} {
  return {
    productActionsVisible: sheets.productActions,
    variantActionsVisible:
      sheets.variantActionId !== null && sheets.variantEditor === null,
    variantEditorVisible: sheets.variantEditor !== null,
    variantEditorMode: sheets.variantEditor?.mode ?? "new",
  };
}
