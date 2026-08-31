/**
 * Product detail facade (SHO-160). Composes query, product/variant
 * actions, the photo session, and the sheet reducer. View stays
 * presentational; no RHF and no XState on this screen.
 */
import { useReducer, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useApiClient } from "../../../../api/api-provider";
import { describeQueryFailure } from "../../../../api/errors";
import { useActiveCompany } from "../../../../api/query-provider";
import { useResolvedCompany } from "../../../../company-resolution/resolved-company-provider";
import { detectLocale } from "../../../../i18n/locale";
import { productsCopy } from "../../../../i18n/products";
import {
  PRODUCT_FORM_MAX_VARIANTS,
  PRODUCT_NAME_MAX,
} from "../shared/product-caps";
import {
  canEditProducts,
  canFetchFileDownloadUrls,
} from "../shared/product-permissions";
import { useProductPhotos } from "../photos/use-product-photos";
import {
  resolvePhotoBanner,
  resolveProductPhotosBannerKey,
} from "../photos/product-photos-banners";
import { productFacts, productHeaderSubtitle } from "./product-detail-model";
import {
  photoManagerInputFromDetailQuery,
  productDetailViewerDownloadQueryOptions,
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

const EMPTY_FILE_IDS: readonly string[] = [];
const EMPTY_DOWNLOAD_FILES: ReadonlyArray<{
  readonly fileId: string;
  readonly downloadUrl: string;
}> = [];

export function useProductDetail(idParam: string | string[] | undefined) {
  const locale = detectLocale();
  const copy = useMemo(() => productsCopy(locale), [locale]);
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
  const photoFileIds = query.product?.imageFileIds ?? EMPTY_FILE_IDS;
  const urlsQuery = useQuery(
    productDetailViewerDownloadQueryOptions({
      client: apiClient,
      companyId: activeCompanyId,
      getActiveCompany: () => apiClient?.getActiveCompany() ?? null,
      imageFileIds: photoFileIds,
      canEdit,
      canFetchImages,
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
  const viewerTiles = useMemo(
    () => detailViewerPhotoTiles(photoFileIds),
    [photoFileIds],
  );
  const viewerPreview = useMemo(
    () =>
      detailViewerPreviewByFileId(
        urlsQuery.data?.files ?? EMPTY_DOWNLOAD_FILES,
      ),
    [urlsQuery.data?.files],
  );

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
    photoTiles: canEdit ? photos.tiles : viewerTiles,
    previewByFileId: canEdit ? photos.previewByFileId : viewerPreview,
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

export type ProductDetailModel = ReturnType<typeof useProductDetail>;
