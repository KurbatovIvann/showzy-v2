/**
 * Create/edit variant from the detail sheet, plus variant archive/restore
 * (SHO-152 / SHO-160). Status writes share `useDetailStatusWrite`.
 */
import { useSheetHiddenWaiter } from "../../../../hooks/use-sheet-hidden-waiter";
import type { ProductsCopy } from "../../../../i18n/products";
import type { ProductFormVariantDraft } from "../form/product-form-draft";
import {
  resolveSelectedVariant,
  resultForVariantSheetAction,
  type ProductDetailViewModel,
  type ProductVariantView,
  type VariantSheetActionId,
} from "./product-detail-model";
import type { DetailStatusWrite } from "./use-product-detail-actions";
import type {
  DetailSheets,
  ProductDetailSheetAction,
} from "./product-detail.reducer";
import { useVariantEditor } from "./use-variant-editor";
import {
  variantAccessibilityLabel,
  variantPriceLabel,
} from "./variant-actions-labels";

export function useVariantActions(args: {
  readonly copy: ProductsCopy;
  readonly product: ProductDetailViewModel | null;
  readonly productId: string | null;
  readonly sheets: DetailSheets;
  readonly dispatch: (action: ProductDetailSheetAction) => void;
  readonly status: DetailStatusWrite;
}): {
  readonly variantActionsTitle: string;
  readonly variantActionsArchived: boolean;
  readonly variantEditorMode: "new" | "edit";
  readonly variantSheetInitial: ProductFormVariantDraft | null;
  readonly variantBanner: string | null;
  readonly variantPending: boolean;
  readonly onVariantActionsHidden: () => void;
  readonly openVariantActions: (id: string) => void;
  readonly closeVariantActions: () => void;
  readonly onVariantSheetAction: (action: VariantSheetActionId) => void;
  readonly openNewVariant: () => void;
  readonly closeVariantEditor: () => void;
  readonly saveVariantFromSheet: (input: {
    readonly name: string;
    readonly priceText: string;
  }) => void;
  readonly variantPriceLabel: (variant: ProductVariantView) => string;
  readonly variantAccessibilityLabel: (variant: ProductVariantView) => string;
} {
  const variantHidden = useSheetHiddenWaiter();
  const selectedVariant = resolveSelectedVariant(
    args.product,
    args.sheets.variantActionId,
  );
  const variantForChrome =
    args.sheets.variantActionId === null
      ? null
      : {
          id: args.sheets.variantActionId,
          name: args.sheets.variantActionName,
          archived: args.sheets.variantActionArchived,
        };
  const editor = useVariantEditor({
    formCopy: args.copy.form,
    product: args.product,
    productId: args.productId,
    sheets: args.sheets,
    selectedVariant,
    dispatch: args.dispatch,
  });

  return {
    variantActionsTitle: variantForChrome?.name ?? "",
    variantActionsArchived: variantForChrome?.archived === true,
    variantEditorMode: editor.variantEditorMode,
    variantSheetInitial: editor.variantSheetInitial,
    variantBanner: editor.variantBanner,
    variantPending: editor.variantPending,
    onVariantActionsHidden: variantHidden.notify,
    openVariantActions: (id) => {
      const variant = args.product?.variants.find((item) => item.id === id);
      args.dispatch({
        type: "openVariantActions",
        variantId: id,
        name: variant?.name ?? "",
        archived: variant?.archived === true,
      });
    },
    closeVariantActions: () => {
      args.dispatch({ type: "closeAll" });
    },
    onVariantSheetAction: (action) => {
      if (variantForChrome === null) {
        return;
      }
      const result = resultForVariantSheetAction({
        action,
        archived: variantForChrome.archived,
        variantId: variantForChrome.id,
        variantName: variantForChrome.name,
      });
      if (result.kind === "editor") {
        editor.resetEditorFeedback();
        args.dispatch({
          type: "openVariantEditor",
          variantId: variantForChrome.id,
        });
        return;
      }
      void args.status.promptConfirm({
        target: result.target,
        variantActionId: variantForChrome.id,
        variantActionName: variantForChrome.name,
        variantActionArchived: variantForChrome.archived,
        waitHidden: variantHidden.wait,
      });
    },
    openNewVariant: editor.openNewVariant,
    closeVariantEditor: editor.closeVariantEditor,
    saveVariantFromSheet: editor.saveVariantFromSheet,
    variantPriceLabel: (variant) => variantPriceLabel(args.copy, variant),
    variantAccessibilityLabel: (variant) =>
      variantAccessibilityLabel(args.copy, variant),
  };
}
