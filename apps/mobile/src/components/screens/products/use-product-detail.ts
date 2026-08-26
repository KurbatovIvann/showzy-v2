import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { detectLocale } from "../../../i18n/locale";
import { productsCopy } from "../../../i18n/products";
import {
  bindCatalogStatusMutate,
  invalidateCatalogAfterStatusWrite,
  type CatalogStatusWrite,
} from "./product-archive";
import {
  classifyProductDetail,
  confirmIsDestructive,
  confirmSheetCopy,
  IDLE_DETAIL_SHEETS,
  isConfirmWriteBusy,
  mapStatusWriteFailure,
  planConfirmStatusWrite,
  productEditorHref,
  productFacts,
  productHeaderSubtitle,
  productIdFromParam,
  resultForProductSheetAction,
  resultForVariantSheetAction,
  sheetsAfterCloseVariantEditor,
  sheetsAfterDismissConfirm,
  sheetsAfterProductSheetAction,
  sheetsAfterVariantSheetAction,
  sheetsOpenNewVariant,
  sheetsOpenProductActions,
  sheetsOpenVariantActions,
  statusWriteBanner,
  statusWriteForConfirm,
  toProductDetailView,
  variantRowActionsLabel,
  variantRowPriceLabel,
  type ConfirmTarget,
  type DetailSheets,
  type ProductDetailState,
  type ProductDetailViewModel,
  type ProductFacts,
  type ProductSheetActionId,
  type ProductVariantView,
  type VariantSheetActionId,
} from "./product-detail-model";
import { getProductQueryOptions } from "./product-detail-query";
import {
  detailVariantBanner,
  detailVariantToDraft,
  planDetailVariantWrite,
} from "./product-detail-variant-write";
import {
  mapProductFormFailure,
  PRODUCT_FORM_MAX_VARIANTS,
  PRODUCT_NAME_MAX,
  writesEqual,
  type ProductFormVariantDraft,
  type ProductFormWrite,
} from "./product-form-model";
import { bindProductFormMutate } from "./product-form-mutation";
import {
  canEditProducts,
  canFetchFileDownloadUrls,
} from "./product-permissions";

export type ProductDetailModel = {
  readonly copy: ReturnType<typeof productsCopy>;
  readonly state: ProductDetailState;
  readonly product: ProductDetailViewModel | null;
  readonly facts: ProductFacts | null;
  readonly canEdit: boolean;
  readonly canAddVariant: boolean;
  readonly canFetchImages: boolean;
  readonly nameMaxLength: number;
  readonly confirm: ConfirmTarget | null;
  readonly confirmCopy: ReturnType<typeof confirmSheetCopy> | null;
  readonly confirmBanner: string | null;
  readonly confirmPending: boolean;
  readonly confirmDestructive: boolean;
  readonly headerTitle: string;
  readonly headerSubtitle: string;
  readonly productActionsVisible: boolean;
  readonly variantActionsVisible: boolean;
  readonly variantActionsTitle: string;
  readonly variantActionsArchived: boolean;
  readonly variantEditorVisible: boolean;
  readonly variantEditorMode: "new" | "edit";
  readonly variantSheetInitial: ProductFormVariantDraft | null;
  readonly variantBanner: string | null;
  readonly variantPending: boolean;
  readonly goBack: () => void;
  readonly retry: () => void;
  readonly openEdit: () => void;
  readonly openPhotos: () => void;
  readonly openProductActions: () => void;
  readonly closeProductActions: () => void;
  readonly onProductSheetAction: (action: ProductSheetActionId) => void;
  readonly openVariantActions: (id: string) => void;
  readonly closeVariantActions: () => void;
  readonly onVariantSheetAction: (action: VariantSheetActionId) => void;
  readonly openNewVariant: () => void;
  readonly closeVariantEditor: () => void;
  readonly saveVariantFromSheet: (input: {
    readonly name: string;
    readonly priceText: string;
  }) => void;
  readonly closeConfirm: () => void;
  readonly confirmStatusWrite: () => void;
  readonly variantPriceLabel: (variant: ProductVariantView) => string;
  readonly variantAccessibilityLabel: (variant: ProductVariantView) => string;
};

export function useProductDetail(
  idParam: string | string[] | undefined,
): ProductDetailModel {
  const locale = detectLocale();
  const copy = productsCopy(locale);
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const router = useRouter();
  const queryClient = useQueryClient();
  const productId = productIdFromParam(idParam);
  const [sheets, setSheets] = useState<DetailSheets>(IDLE_DETAIL_SHEETS);
  const lastConfirmRef = useRef<ConfirmTarget | null>(null);
  const lastVariantRef = useRef<ProductVariantView | null>(null);
  const lastVariantWriteRef = useRef<ProductFormWrite | null>(null);
  const writeBusyRef = useRef(false);
  const [writeBusy, setWriteBusy] = useState(false);
  const variantBusyRef = useRef(false);
  const [variantBusy, setVariantBusy] = useState(false);
  const [variantBannerKey, setVariantBannerKey] =
    useState<ReturnType<typeof mapProductFormFailure>>(null);
  if (sheets.confirm !== null) {
    lastConfirmRef.current = sheets.confirm;
  }
  const sheetTarget = sheets.confirm ?? lastConfirmRef.current;

  const query = useQuery(
    getProductQueryOptions({
      client: apiClient,
      companyId: activeCompanyId,
      productId,
      getActiveCompany: () => apiClient?.getActiveCompany() ?? null,
    }),
  );

  const mutation = useContractMutation((input: CatalogStatusWrite, options) => {
    const current = apiRef.current;
    if (current === null) {
      return Promise.reject(new TypeError("Failed to fetch"));
    }
    return bindCatalogStatusMutate(current)(input, options);
  });

  const variantMutation = useContractMutation(
    (input: ProductFormWrite, options) => {
      const current = apiRef.current;
      if (current === null) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return bindProductFormMutate(current)(input, options);
    },
  );

  const failureKind = query.isError
    ? describeQueryFailure(query.error).kind
    : null;
  const state = classifyProductDetail({
    productId,
    clientReady: apiClient !== null && activeCompanyId !== null,
    status: query.status,
    failureKind,
  });
  const product =
    query.data === undefined ? null : toProductDetailView(query.data);
  const mutationFailure = mutation.isError
    ? describeQueryFailure(mutation.error).kind
    : null;
  const canEdit = canEditProducts(membership.role);
  const selectedVariant = resolveSelectedVariant(
    product,
    sheets.variantActionId,
  );
  if (selectedVariant !== null) {
    lastVariantRef.current = selectedVariant;
  }
  const variantForChrome = selectedVariant ?? lastVariantRef.current;

  function navigateEdit(): void {
    setSheets(IDLE_DETAIL_SHEETS);
    if (productId !== null) {
      router.push(productEditorHref(productId));
    }
  }

  async function submitConfirm(): Promise<void> {
    if (
      sheets.confirm === null ||
      productId === null ||
      writeBusyRef.current ||
      mutation.isPending
    ) {
      return;
    }
    writeBusyRef.current = true;
    setWriteBusy(true);
    try {
      if (planConfirmStatusWrite(mutation.isError) === "retry") {
        await mutation.retry();
      } else {
        await mutation.submit(statusWriteForConfirm(sheets.confirm, productId));
      }
      await invalidateCatalogAfterStatusWrite({
        queryClient,
        companyId: activeCompanyId,
      });
      setSheets(IDLE_DETAIL_SHEETS);
      mutation.reset();
    } catch {
      // Banner is derived from mutation.error.
    } finally {
      writeBusyRef.current = false;
      setWriteBusy(false);
    }
  }

  async function submitVariantWrite(write: ProductFormWrite): Promise<void> {
    if (variantBusyRef.current || variantMutation.isPending) {
      return;
    }
    variantBusyRef.current = true;
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
      setSheets(IDLE_DETAIL_SHEETS);
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
      variantBusyRef.current = false;
      setVariantBusy(false);
    }
  }

  const facts =
    product === null
      ? null
      : productFacts({
          archived: product.archived,
          statusActive: copy.detail.statusActive,
          statusArchived: copy.archivedBadge,
          priceLabel: product.priceLabel,
          variantCount: product.variants.length,
          locale,
          variantForms: copy.variants,
        });

  return {
    copy,
    state,
    product,
    facts,
    canEdit,
    canAddVariant:
      canEdit &&
      product !== null &&
      product.variants.length < PRODUCT_FORM_MAX_VARIANTS,
    canFetchImages: canFetchFileDownloadUrls(membership.role),
    nameMaxLength: PRODUCT_NAME_MAX,
    confirm: sheets.confirm,
    confirmCopy:
      sheetTarget === null ? null : confirmSheetCopy(sheetTarget, copy.detail),
    confirmBanner: statusWriteBanner(
      mapStatusWriteFailure(mutationFailure),
      copy.detail,
    ),
    confirmPending: isConfirmWriteBusy({
      mutationPending: mutation.isPending,
      writeBusy,
    }),
    confirmDestructive:
      sheetTarget !== null && confirmIsDestructive(sheetTarget),
    headerTitle: product?.name ?? copy.detail.title,
    headerSubtitle:
      product === null
        ? ""
        : productHeaderSubtitle({
            archived: product.archived,
            statusActive: copy.detail.statusActive,
            statusArchived: copy.archivedBadge,
            priceLabel: product.priceLabel,
          }),
    productActionsVisible: sheets.productActions,
    variantActionsVisible:
      sheets.variantActionId !== null &&
      sheets.variantEditor === null &&
      sheets.confirm === null,
    variantActionsTitle: variantForChrome?.name ?? "",
    variantActionsArchived: variantForChrome?.archived === true,
    variantEditorVisible: sheets.variantEditor !== null,
    variantEditorMode: sheets.variantEditor?.mode ?? "new",
    variantSheetInitial:
      sheets.variantEditor?.mode === "edit"
        ? detailVariantToDraft(variantForChrome)
        : null,
    variantBanner: detailVariantBanner(variantBannerKey, copy.form),
    variantPending: isConfirmWriteBusy({
      mutationPending: variantMutation.isPending,
      writeBusy: variantBusy,
    }),
    goBack: () => {
      router.back();
    },
    retry: () => {
      void query.refetch();
    },
    openEdit: navigateEdit,
    openPhotos: navigateEdit,
    openProductActions: () => {
      setSheets(sheetsOpenProductActions());
    },
    closeProductActions: () => {
      setSheets(IDLE_DETAIL_SHEETS);
    },
    onProductSheetAction: (action) => {
      if (product === null) {
        return;
      }
      const result = resultForProductSheetAction({
        action,
        archived: product.archived,
      });
      if (result.kind === "navigate-edit") {
        navigateEdit();
        return;
      }
      mutation.reset();
      setSheets(sheetsAfterProductSheetAction(result));
    },
    openVariantActions: (id) => {
      setSheets(sheetsOpenVariantActions(id));
    },
    closeVariantActions: () => {
      setSheets(IDLE_DETAIL_SHEETS);
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
      } else {
        mutation.reset();
      }
      setSheets(
        sheetsAfterVariantSheetAction({
          variantId: variantForChrome.id,
          result,
        }),
      );
    },
    openNewVariant: () => {
      if (
        product === null ||
        product.variants.length >= PRODUCT_FORM_MAX_VARIANTS
      ) {
        setVariantBannerKey("too_many_variants");
        return;
      }
      variantMutation.reset();
      setVariantBannerKey(null);
      setSheets(sheetsOpenNewVariant());
    },
    closeVariantEditor: () => {
      variantMutation.reset();
      setVariantBannerKey(null);
      setSheets(sheetsAfterCloseVariantEditor(sheets));
    },
    saveVariantFromSheet: (input) => {
      if (productId === null || product === null) {
        return;
      }
      const editor = sheets.variantEditor;
      if (editor === null) {
        return;
      }
      const existingVariant =
        editor.mode === "edit"
          ? product.variants.find((item) => item.id === editor.variantId)
          : undefined;
      if (editor.mode === "edit" && existingVariant === undefined) {
        setSheets(IDLE_DETAIL_SHEETS);
        return;
      }
      const plan = planDetailVariantWrite({
        productId,
        variantCount: product.variants.length,
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
        setSheets(IDLE_DETAIL_SHEETS);
        return;
      }
      void submitVariantWrite(plan.write);
    },
    closeConfirm: () => {
      if (
        !isConfirmWriteBusy({
          mutationPending: mutation.isPending,
          writeBusy,
        })
      ) {
        setSheets(sheetsAfterDismissConfirm(sheets));
        mutation.reset();
      }
    },
    confirmStatusWrite: () => {
      void submitConfirm();
    },
    variantPriceLabel: (variant) =>
      variantRowPriceLabel({
        inherited: variant.priceInherited,
        priceLabel: variant.priceLabel,
        inheritedTemplate: copy.form.variantInheritedPrice,
      }),
    variantAccessibilityLabel: (variant) =>
      variantRowActionsLabel({
        variantName: variant.name,
        template: copy.detail.variantActionsLabel,
      }),
  };
}

function resolveSelectedVariant(
  product: ProductDetailViewModel | null,
  variantActionId: string | null,
): ProductVariantView | null {
  if (product === null || variantActionId === null) {
    return null;
  }
  return (
    product.variants.find((variant) => variant.id === variantActionId) ?? null
  );
}
