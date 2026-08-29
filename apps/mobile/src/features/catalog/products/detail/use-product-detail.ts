/**
 * Product detail facade (SHO-160). Composes query, product/variant
 * actions, the photo session, and the sheet reducer. View stays
 * presentational; no RHF and no XState on this screen.
 */
import { useReducer, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useApiClient } from "../../../../api/api-provider";
import { describeQueryFailure } from "../../../../api/errors";
import { fileDownloadUrlsQueryOptions } from "../../../../api/file-download-query";
import { useActiveCompany } from "../../../../api/query-provider";
import { useResolvedCompany } from "../../../../company-resolution/resolved-company-provider";
import { detectLocale } from "../../../../i18n/locale";
import { productsCopy } from "../../../../i18n/products";
import {
  PRODUCT_FORM_MAX_VARIANTS,
  PRODUCT_NAME_MAX,
} from "../shared/product-caps";
import { type ProductFormVariantDraft } from "../form/product-form-draft";
import {
  canEditProducts,
  canFetchFileDownloadUrls,
} from "../shared/product-permissions";
import {
  useProductPhotos,
  type ProductPhotosModel,
} from "../photos/use-product-photos";
import {
  resolvePhotoBanner,
  resolveProductPhotosBannerKey,
  type PhotoTileView,
} from "../photos/product-photos-model";
import {
  productFacts,
  productHeaderSubtitle,
  type ProductDetailState,
  type ProductDetailViewModel,
  type ProductFacts,
  type ProductSheetActionId,
  type ProductVariantView,
  type VariantSheetActionId,
} from "./product-detail-model";
import {
  photoManagerInputFromDetailQuery,
  detailViewerPhotoTiles,
  detailViewerPreviewByFileId,
} from "./product-detail-photos";
import {
  IDLE_DETAIL_SHEETS,
  productDetailSheetChrome,
  reduceProductDetailSheets,
} from "./product-detail.reducer";
import {
  useDetailStatusWrite,
  useProductDetailActions,
} from "./use-product-detail-actions";
import { useProductDetailQuery } from "./use-product-detail-query";
import { useVariantActions } from "./use-variant-actions";

export type ProductDetailModel = {
  readonly copy: ReturnType<typeof productsCopy>;
  readonly state: ProductDetailState;
  readonly product: ProductDetailViewModel | null;
  readonly facts: ProductFacts | null;
  readonly canEdit: boolean;
  readonly canAddVariant: boolean;
  readonly photoTiles: readonly PhotoTileView[];
  readonly previewByFileId: ReadonlyMap<string, string>;
  readonly viewerPhotoBanner: string | null;
  readonly photos: ProductPhotosModel;
  readonly photosFocus: number;
  readonly nameMaxLength: number;
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
  readonly statusBanner: string | null;
  readonly goBack: () => void;
  readonly retry: () => void;
  readonly openEdit: () => void;
  readonly openPhotos: () => void;
  readonly onProductActionsHidden: () => void;
  readonly onVariantActionsHidden: () => void;
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
  readonly variantPriceLabel: (variant: ProductVariantView) => string;
  readonly variantAccessibilityLabel: (variant: ProductVariantView) => string;
};

export function useProductDetail(
  idParam: string | string[] | undefined,
): ProductDetailModel {
  const locale = detectLocale();
  const copy = productsCopy(locale);
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const canEdit = canEditProducts(membership.role);
  const canFetchImages = canFetchFileDownloadUrls(membership.role);
  const [sheets, dispatch] = useReducer(
    reduceProductDetailSheets,
    IDLE_DETAIL_SHEETS,
  );
  const [photosFocus, setPhotosFocus] = useState(0);
  const query = useProductDetailQuery(idParam);
  const photos = useProductPhotos(
    photoManagerInputFromDetailQuery({
      productId: query.productId,
      imageFileIds: query.imageFileIds,
      canWrite: canEdit,
    }),
  );
  const { openPicker } = photos;
  const photoFileIds = query.product?.imageFileIds ?? [];
  const urlsQuery = useQuery(
    fileDownloadUrlsQueryOptions({
      client: !canEdit && canFetchImages ? apiClient : null,
      companyId: activeCompanyId,
      fileIds: canEdit ? [] : photoFileIds,
      getActiveCompany: () => apiClient?.getActiveCompany() ?? null,
    }),
  );
  const status = useDetailStatusWrite({
    productId: query.productId,
    copy: copy.detail,
    dispatch,
  });
  const productActions = useProductDetailActions({
    product: query.product,
    productId: query.productId,
    dispatch,
    status,
    openPicker,
    bumpPhotosFocus: () => {
      setPhotosFocus((count) => count + 1);
    },
  });
  const variantActions = useVariantActions({
    copy,
    product: query.product,
    productId: query.productId,
    sheets,
    dispatch,
    status,
  });
  const chrome = productDetailSheetChrome(sheets);
  const product = query.product;
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
    state: query.state,
    product,
    facts,
    canEdit,
    canAddVariant:
      canEdit &&
      product !== null &&
      product.variants.length < PRODUCT_FORM_MAX_VARIANTS,
    photoTiles: canEdit ? photos.tiles : detailViewerPhotoTiles(photoFileIds),
    previewByFileId: canEdit
      ? photos.previewByFileId
      : detailViewerPreviewByFileId(urlsQuery.data?.files ?? []),
    viewerPhotoBanner: resolvePhotoBanner(
      copy.photos,
      resolveProductPhotosBannerKey({
        localBanner: null,
        mutationFailure: null,
        downloadFailure:
          !canEdit && urlsQuery.isError
            ? describeQueryFailure(urlsQuery.error).kind
            : null,
      }),
    ),
    photos,
    photosFocus,
    nameMaxLength: PRODUCT_NAME_MAX,
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
    productActionsVisible: chrome.productActionsVisible,
    variantActionsVisible: chrome.variantActionsVisible,
    variantActionsTitle: variantActions.variantActionsTitle,
    variantActionsArchived: variantActions.variantActionsArchived,
    variantEditorVisible: chrome.variantEditorVisible,
    variantEditorMode: variantActions.variantEditorMode,
    variantSheetInitial: variantActions.variantSheetInitial,
    variantBanner: variantActions.variantBanner,
    variantPending: variantActions.variantPending,
    statusBanner: status.banner,
    goBack: productActions.goBack,
    retry: query.retry,
    openEdit: productActions.openEdit,
    openPhotos: () => {
      setPhotosFocus((count) => count + 1);
      openPicker();
    },
    onProductActionsHidden: productActions.onProductActionsHidden,
    onVariantActionsHidden: variantActions.onVariantActionsHidden,
    openProductActions: productActions.openProductActions,
    closeProductActions: productActions.closeProductActions,
    onProductSheetAction: productActions.onProductSheetAction,
    openVariantActions: variantActions.openVariantActions,
    closeVariantActions: variantActions.closeVariantActions,
    onVariantSheetAction: variantActions.onVariantSheetAction,
    openNewVariant: variantActions.openNewVariant,
    closeVariantEditor: variantActions.closeVariantEditor,
    saveVariantFromSheet: variantActions.saveVariantFromSheet,
    variantPriceLabel: variantActions.variantPriceLabel,
    variantAccessibilityLabel: variantActions.variantAccessibilityLabel,
  };
}
