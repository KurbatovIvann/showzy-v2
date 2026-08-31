/**
 * Create/edit variant from the detail sheet, plus variant archive/restore
 * (SHO-152 / SHO-160). Status writes share `useDetailStatusWrite`.
 */
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  describeQueryFailure,
  describeWireError,
} from "../../../../api/errors";
import { useActiveCompany } from "../../../../api/query-provider";
import { useBoundContractMutation } from "../../../../api/use-bound-contract-mutation";
import { useSheetHiddenWaiter } from "../../../../hooks/use-sheet-hidden-waiter";
import type { ProductsCopy } from "../../../../i18n/products";
import { invalidateCatalogAfterStatusWrite } from "../api/product-archive";
import { bindProductFormMutate } from "../api/product-form-mutation";
import { mapProductFormFailure } from "../form/product-form-copy";
import type { ProductFormVariantDraft } from "../form/product-form-draft";
import { writesEqual, type ProductFormWrite } from "../form/product-form-plan";
import { PRODUCT_FORM_MAX_VARIANTS } from "../shared/product-caps";
import {
  isConfirmWriteBusy,
  resolveSelectedVariant,
  resultForVariantSheetAction,
  variantRowActionsLabel,
  variantRowPriceLabel,
  type ProductDetailViewModel,
  type ProductVariantView,
  type VariantSheetActionId,
} from "./product-detail-model";
import {
  detailVariantBanner,
  detailVariantToDraft,
  planDetailVariantWrite,
} from "./product-detail-variant-write";
import type { DetailStatusWrite } from "./use-product-detail-actions";
import type {
  DetailSheets,
  ProductDetailSheetAction,
} from "./product-detail.reducer";

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
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const lastVariantWriteRef = useRef<ProductFormWrite | null>(null);
  const [variantBusy, setVariantBusy] = useState(false);
  const [variantBannerKey, setVariantBannerKey] =
    useState<ReturnType<typeof mapProductFormFailure>>(null);
  const variantHidden = useSheetHiddenWaiter();
  const variantMutation = useBoundContractMutation((client) =>
    bindProductFormMutate(client),
  );

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

  async function submitVariantWrite(write: ProductFormWrite): Promise<void> {
    await variantMutation.runGuarded(async () => {
      setVariantBusy(true);
      setVariantBannerKey(null);
      try {
        const reuse =
          variantMutation.isError &&
          lastVariantWriteRef.current !== null &&
          writesEqual(lastVariantWriteRef.current, write);
        if (reuse) {
          await variantMutation.retry();
        } else {
          lastVariantWriteRef.current = write;
          await variantMutation.submit(write);
        }
        await invalidateCatalogAfterStatusWrite({
          queryClient,
          companyId: activeCompanyId,
        });
        args.dispatch({ type: "closeAll" });
        variantMutation.reset();
        lastVariantWriteRef.current = null;
      } catch (error) {
        setVariantBannerKey(
          mapProductFormFailure(
            describeQueryFailure(error).kind,
            describeWireError(error)?.code ?? null,
          ),
        );
      } finally {
        setVariantBusy(false);
      }
    });
  }

  return {
    variantActionsTitle: variantForChrome?.name ?? "",
    variantActionsArchived: variantForChrome?.archived === true,
    variantEditorMode: args.sheets.variantEditor?.mode ?? "new",
    variantSheetInitial:
      args.sheets.variantEditor?.mode === "edit"
        ? detailVariantToDraft(selectedVariant)
        : null,
    variantBanner: detailVariantBanner(variantBannerKey, args.copy.form),
    variantPending: isConfirmWriteBusy({
      mutationPending: variantMutation.isPending,
      writeBusy: variantBusy,
    }),
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
        variantMutation.reset();
        setVariantBannerKey(null);
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
    openNewVariant: () => {
      if (
        args.product === null ||
        args.product.variants.length >= PRODUCT_FORM_MAX_VARIANTS
      ) {
        setVariantBannerKey("too_many_variants");
        return;
      }
      variantMutation.reset();
      setVariantBannerKey(null);
      args.dispatch({ type: "openNewVariant" });
    },
    closeVariantEditor: () => {
      variantMutation.reset();
      setVariantBannerKey(null);
      args.dispatch({ type: "closeVariantEditor" });
    },
    saveVariantFromSheet: (input) => {
      if (args.productId === null || args.product === null) {
        return;
      }
      const editor = args.sheets.variantEditor;
      if (editor === null) {
        return;
      }
      const existingVariant =
        editor.mode === "edit"
          ? args.product.variants.find((item) => item.id === editor.variantId)
          : undefined;
      if (editor.mode === "edit" && existingVariant === undefined) {
        args.dispatch({ type: "closeAll" });
        return;
      }
      const plan = planDetailVariantWrite({
        productId: args.productId,
        variantCount: args.product.variants.length,
        existing:
          existingVariant === undefined
            ? null
            : {
                variantId: existingVariant.id,
                name: existingVariant.name,
                priceMinor: existingVariant.priceMinor,
              },
        name: input.name,
        priceText: input.priceText,
      });
      if (plan.kind === "invalid") {
        return;
      }
      if (plan.kind === "too_many") {
        setVariantBannerKey("too_many_variants");
        return;
      }
      if (plan.kind === "noop") {
        args.dispatch({ type: "closeAll" });
        return;
      }
      void submitVariantWrite(plan.write);
    },
    variantPriceLabel: (variant) =>
      variantRowPriceLabel({
        inherited: variant.priceInherited,
        priceLabel: variant.priceLabel,
        inheritedTemplate: args.copy.form.variantInheritedPrice,
      }),
    variantAccessibilityLabel: (variant) =>
      variantRowActionsLabel({
        variantName: variant.name,
        template: args.copy.detail.variantActionsLabel,
      }),
  };
}
