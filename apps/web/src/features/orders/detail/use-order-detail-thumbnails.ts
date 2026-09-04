/**
 * Detail line thumbnails. Hydrates catalog primary images via the
 * existing staff `catalog.getProduct` binder, then `files.getDownloadUrls`.
 * Does not import a catalog feature.
 *
 * Always call this hook from `useOrderDetail`. Never return before the
 * Query hooks — empty `productIds` or `enabled: false` still run
 * `useQueries` / `useOrderThumbnails` so React hook order stays stable
 * while `orders.get` goes from loading → ready.
 */
import { useQueries } from "@tanstack/react-query";
import { useMemo, useRef } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useActiveCompany } from "../../../api/query-provider";
import { catalogGetProductQueryOptions } from "../api/catalog";
import {
  orderLineCatalogImages,
  orderLineThumbnailFileId,
  reuseOrderLineCatalogImages,
} from "./order-detail.presenter";
import {
  orderThumbnailView,
  type OrderThumbnailView,
} from "../shared/order-thumbnails";
import { useOrderThumbnails } from "../shared/use-order-thumbnails";

export function useOrderDetailThumbnails(args: {
  readonly productIds: readonly string[];
  readonly enabled: boolean;
  readonly canFetchThumbnails: boolean;
}): ReadonlyMap<string, OrderThumbnailView> {
  const client = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const getActiveCompany = () => client.getActiveCompany();
  const productIds = args.productIds;

  const productQueries = useQueries({
    queries: productIds.map((productId) => {
      const options = catalogGetProductQueryOptions({
        client,
        companyId: activeCompanyId,
        productId,
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
    client,
    companyId: activeCompanyId,
    getActiveCompany,
    pages: [{ items }],
    enabled: args.enabled && args.canFetchThumbnails,
  });

  return useMemo(() => {
    const map = new Map<string, OrderThumbnailView>();
    for (const item of items) {
      const fileId = orderLineThumbnailFileId(
        args.canFetchThumbnails,
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
  }, [args.canFetchThumbnails, failedFileIds, items, urlsByFileId]);
}
