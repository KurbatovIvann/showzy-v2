/**
 * Detail line thumbnails (SHO-243). Hydrates catalog primary images
 * via the existing staff `catalog.getProduct` binder, then
 * `files.getDownloadUrls`. Does not import `features/catalog`. Skip
 * download URLs without `files:view`.
 */
import { useQueries } from "@tanstack/react-query";
import { useMemo, useRef } from "react";

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
import {
  orderLineCatalogImages,
  orderLineThumbnailFileId,
  reuseOrderLineCatalogImages,
} from "./order-detail-model";

export function useOrderDetailThumbnails(args: {
  readonly productIds: readonly string[];
  readonly enabled: boolean;
}): ReadonlyMap<string, OrderThumbnailView> {
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;
  const canFetchThumbnails = canFetchFileDownloadUrls(membership);
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

  const imageFileIdsByIndex = productQueries.map(
    (query) => query.data?.imageFileIds,
  );
  const nextItems = orderLineCatalogImages(productIds, imageFileIdsByIndex);
  const itemsRef = useRef(nextItems);
  const items = reuseOrderLineCatalogImages(itemsRef.current, nextItems);
  itemsRef.current = items;

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
      const fileId = orderLineThumbnailFileId(
        canFetchThumbnails,
        item.primaryImageFileId,
      );
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
