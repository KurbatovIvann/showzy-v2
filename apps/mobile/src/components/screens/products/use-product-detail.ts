import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure } from "../../../api/errors";
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
  confirmSheetCopy,
  confirmTargetForProduct,
  confirmTargetForVariant,
  mapStatusWriteFailure,
  planConfirmStatusWrite,
  productIdFromParam,
  statusWriteBanner,
  statusWriteForConfirm,
  toProductDetailView,
  type ConfirmTarget,
  type ProductDetailState,
  type ProductDetailViewModel,
} from "./product-detail-model";
import { getProductQueryOptions } from "./product-detail-query";
import {
  canEditProducts,
  canFetchFileDownloadUrls,
} from "./product-permissions";

export type ProductDetailModel = {
  readonly copy: ReturnType<typeof productsCopy>;
  readonly state: ProductDetailState;
  readonly product: ProductDetailViewModel | null;
  readonly canEdit: boolean;
  readonly canFetchImages: boolean;
  readonly confirm: ConfirmTarget | null;
  readonly confirmCopy: ReturnType<typeof confirmSheetCopy> | null;
  readonly confirmBanner: string | null;
  readonly confirmPending: boolean;
  readonly headerTitle: string;
  readonly goBack: () => void;
  readonly retry: () => void;
  readonly openEdit: () => void;
  readonly openPhotos: () => void;
  readonly requestProductStatus: () => void;
  readonly requestArchiveVariant: (id: string, name: string) => void;
  readonly requestRestoreVariant: (id: string, name: string) => void;
  readonly closeConfirm: () => void;
  readonly confirmStatusWrite: () => void;
};

export function useProductDetail(
  idParam: string | string[] | undefined,
): ProductDetailModel {
  const copy = productsCopy(detectLocale());
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const router = useRouter();
  const queryClient = useQueryClient();
  const productId = productIdFromParam(idParam);
  const [confirm, setConfirm] = useState<ConfirmTarget | null>(null);
  const lastConfirmRef = useRef<ConfirmTarget | null>(null);
  if (confirm !== null) {
    lastConfirmRef.current = confirm;
  }
  const sheetTarget = confirm ?? lastConfirmRef.current;

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

  function openConfirm(target: ConfirmTarget): void {
    mutation.reset();
    setConfirm(target);
  }

  async function submitConfirm(): Promise<void> {
    if (confirm === null || productId === null || mutation.isPending) {
      return;
    }
    try {
      if (planConfirmStatusWrite(mutation.isError) === "retry") {
        await mutation.retry();
      } else {
        await mutation.submit(statusWriteForConfirm(confirm, productId));
      }
      invalidateCatalogAfterStatusWrite({
        queryClient,
        companyId: activeCompanyId,
      });
      setConfirm(null);
      mutation.reset();
    } catch {
      // Banner is derived from mutation.error.
    }
  }

  return {
    copy,
    state,
    product,
    canEdit: canEditProducts(membership.role),
    canFetchImages: canFetchFileDownloadUrls(membership.role),
    confirm,
    confirmCopy:
      sheetTarget === null ? null : confirmSheetCopy(sheetTarget, copy.detail),
    confirmBanner: statusWriteBanner(
      mapStatusWriteFailure(mutationFailure),
      copy.detail,
    ),
    confirmPending: mutation.isPending,
    headerTitle: product?.name ?? copy.detail.title,
    goBack: () => {
      router.back();
    },
    retry: () => {
      void query.refetch();
    },
    openEdit: () => {
      if (productId !== null) {
        router.push(`/products/${productId}/edit`);
      }
    },
    openPhotos: () => {
      if (productId !== null) {
        router.push(`/products/${productId}/photos`);
      }
    },
    requestProductStatus: () => {
      if (product !== null) {
        openConfirm(confirmTargetForProduct(product.archived));
      }
    },
    requestArchiveVariant: (id, name) => {
      openConfirm(
        confirmTargetForVariant({
          archived: false,
          variantId: id,
          variantName: name,
        }),
      );
    },
    requestRestoreVariant: (id, name) => {
      openConfirm(
        confirmTargetForVariant({
          archived: true,
          variantId: id,
          variantName: name,
        }),
      );
    },
    closeConfirm: () => {
      if (!mutation.isPending) {
        setConfirm(null);
        mutation.reset();
      }
    },
    confirmStatusWrite: () => {
      void submitConfirm();
    },
  };
}
