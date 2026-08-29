/**
 * Detail line thumbnails (SHO-243). Hydrates catalog primary images
 * via the existing staff `catalog.getProduct` binder, then
 * `files.getDownloadUrls`. Does not import `features/catalog`. Skip
 * download URLs without `files:view`.
 */
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { getOrderCatalogProductQueryOptions } from "../api/order-catalog-query";
import { canFetchFileDownloadUrls } from "../shared/order-permissions";
import {
  orderThumbnailView,
  type OrderThumbnailView,
} from "../shared/order-thumbnails";
import { useOrderThumbnails } from "../shared/use-order-thumbnails";
import { catalogPrimaryImageFileId } from "./order-detail-model";

export function useOrderDetailThumbnails(args: {
  readonly productIds: readonly string[];
  readonly enabled: boolean;
}): ReadonlyMap<string, OrderThumbnailView> {
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;
  const canFetchThumbnails = canFetchFileDownloadUrls(membership.role);
  const productIds = args.productIds;

  const productQueries = useQueries({
    queries: productIds.map((productId) => {
      const options = getOrderCatalogProductQueryOptions({
        client: apiClient,
        companyId: activeCompanyId,
        productId,
        getActiveCompany,
      });
      return {
        ...options,
        enabled: options.enabled && args.enabled,
      };
    }),
  });

  const items = productIds.map((productId, index) => ({
    productId,
    primaryImageFileId: catalogPrimaryImageFileId(
      productQueries[index]?.data?.imageFileIds,
    ),
  }));

  const { urlsByFileId, failedFileIds } = useOrderThumbnails({
    client: apiClient,
    companyId: activeCompanyId,
    getActiveCompany,
    pages: [{ items }],
    enabled: args.enabled && canFetchThumbnails,
  });

  return useMemo(() => {
    const map = new Map<string, OrderThumbnailView>();
    for (const item of items) {
      const fileId = canFetchThumbnails ? item.primaryImageFileId : null;
      map.set(
        item.productId,
        orderThumbnailView({
          fileId,
          url: fileId === null ? undefined : urlsByFileId.get(fileId),
          downloadFailed: fileId !== null && failedFileIds.has(fileId),
        }),
      );
    }
    return map;
  }, [canFetchThumbnails, failedFileIds, items, urlsByFileId]);
}
