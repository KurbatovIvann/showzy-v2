/**
 * Detail variant editor mutation, banner, and save/open/close wiring
 * (SHO-303). Sheet ⋯ chrome stays in `use-variant-actions.ts`.
 */
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  describeQueryFailure,
  describeWireError,
} from "../../../../api/errors";
import { useActiveCompany } from "../../../../api/query-provider";
import { useBoundContractMutation } from "../../../../api/use-bound-contract-mutation";
import type { ProductsFormCopy } from "../../../../i18n/products";
import { invalidateCatalogAfterStatusWrite } from "../api/product-archive";
import { bindProductFormMutate } from "../api/product-form-mutation";
import { mapProductFormFailure } from "../form/product-form-copy";
import type { ProductFormVariantDraft } from "../form/product-form-draft";
import { writesEqual, type ProductFormWrite } from "../form/product-form-plan";
import { PRODUCT_FORM_MAX_VARIANTS } from "../shared/product-caps";
import {
  isConfirmWriteBusy,
  type ProductDetailViewModel,
  type ProductVariantView,
} from "./product-detail-model";
import {
  detailVariantBanner,
  detailVariantToDraft,
  planDetailVariantWrite,
} from "./product-detail-variant-write";
import type {
  DetailSheets,
  ProductDetailSheetAction,
} from "./product-detail.reducer";

export function useVariantEditor(args: {
  readonly formCopy: ProductsFormCopy;
  readonly product: ProductDetailViewModel | null;
  readonly productId: string | null;
  readonly sheets: DetailSheets;
  readonly selectedVariant: ProductVariantView | null;
  readonly dispatch: (action: ProductDetailSheetAction) => void;
}): {
  readonly variantEditorMode: "new" | "edit";
  readonly variantSheetInitial: ProductFormVariantDraft | null;
  readonly variantBanner: string | null;
  readonly variantPending: boolean;
  readonly resetEditorFeedback: () => void;
  readonly openNewVariant: () => void;
  readonly closeVariantEditor: () => void;
  readonly saveVariantFromSheet: (input: {
    readonly name: string;
    readonly priceText: string;
  }) => void;
} {
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const lastVariantWriteRef = useRef<ProductFormWrite | null>(null);
  const [variantBusy, setVariantBusy] = useState(false);
  const [variantBannerKey, setVariantBannerKey] =
    useState<ReturnType<typeof mapProductFormFailure>>(null);
  const variantMutation = useBoundContractMutation((client) =>
    bindProductFormMutate(client),
  );

  function resetEditorFeedback(): void {
    variantMutation.reset();
    setVariantBannerKey(null);
  }

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
    variantEditorMode: args.sheets.variantEditor?.mode ?? "new",
    variantSheetInitial:
      args.sheets.variantEditor?.mode === "edit"
        ? detailVariantToDraft(args.selectedVariant)
        : null,
    variantBanner: detailVariantBanner(variantBannerKey, args.formCopy),
    variantPending: isConfirmWriteBusy({
      mutationPending: variantMutation.isPending,
      writeBusy: variantBusy,
    }),
    resetEditorFeedback,
    openNewVariant: () => {
      if (
        args.product === null ||
        args.product.variants.length >= PRODUCT_FORM_MAX_VARIANTS
      ) {
        setVariantBannerKey("too_many_variants");
        return;
      }
      resetEditorFeedback();
      args.dispatch({ type: "openNewVariant" });
    },
    closeVariantEditor: () => {
      resetEditorFeedback();
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
  };
}
