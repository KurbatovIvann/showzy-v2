import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import {
  getOrderCatalogProductQueryOptions,
  listOrderProductsInfiniteOptions,
} from "../api/order-catalog-query";
import { listOrderCustomersInfiniteOptions } from "../api/order-customers-query";
import { canFetchFileDownloadUrls } from "../shared/order-permissions";
import {
  orderThumbnailView,
  type OrderThumbnailView,
} from "../shared/order-thumbnails";
import { useOrderThumbnails } from "../shared/use-order-thumbnails";
import { flattenPages, optionSelectItems } from "./option-select";
import type { ProductVariantsLoadStatus } from "./product-select";
import { useDrainInfinitePages } from "./use-drain-pages";

export type OrderFormProductRow = {
  readonly id: string;
  readonly name: string;
  readonly variantCount: number;
  readonly primaryImageFileId: string | null;
};

export type OrderFormThumbnail = OrderThumbnailView;

export function useOrderFormLookups(args: {
  readonly enabled: boolean;
  readonly variantProductId: string | null;
}): {
  readonly customerOptions: ReturnType<typeof optionSelectItems>;
  readonly productRows: readonly OrderFormProductRow[];
  readonly variantOptions: ReturnType<typeof optionSelectItems>;
  readonly variantsStatus: ProductVariantsLoadStatus;
  readonly thumbnailsByProductId: ReadonlyMap<string, OrderFormThumbnail>;
} {
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;
  const enabled = args.enabled;
  const canFetchThumbnails = canFetchFileDownloadUrls(membership.role);

  const customersQuery = useInfiniteQuery(
    listOrderCustomersInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      getActiveCompany,
      enabled,
    }),
  );
  useDrainInfinitePages({
    status: customersQuery.status,
    hasNextPage: customersQuery.hasNextPage,
    isFetchingNextPage: customersQuery.isFetchingNextPage,
    fetchNextPage: customersQuery.fetchNextPage,
  });

  const productsQuery = useInfiniteQuery(
    listOrderProductsInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      getActiveCompany,
      enabled,
    }),
  );
  useDrainInfinitePages({
    status: productsQuery.status,
    hasNextPage: productsQuery.hasNextPage,
    isFetchingNextPage: productsQuery.isFetchingNextPage,
    fetchNextPage: productsQuery.fetchNextPage,
  });

  const productQuery = useQuery(
    getOrderCatalogProductQueryOptions({
      client: apiClient,
      companyId: activeCompanyId,
      productId: args.variantProductId,
      getActiveCompany,
    }),
  );

  const productPages = productsQuery.data?.pages ?? [];
  const { urlsByFileId, failedFileIds } = useOrderThumbnails({
    client: apiClient,
    companyId: activeCompanyId,
    getActiveCompany,
    pages: productPages,
    enabled: enabled && canFetchThumbnails,
  });

  const customerOptions = useMemo(() => {
    if (customersQuery.data === undefined) {
      return [];
    }
    const rows = flattenPages(customersQuery.data.pages);
    return optionSelectItems(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.phone,
      })),
    );
  }, [customersQuery.data]);

  const productRows = useMemo((): readonly OrderFormProductRow[] => {
    if (productsQuery.data === undefined) {
      return [];
    }
    return flattenPages(productsQuery.data.pages).map((row) => ({
      id: row.id,
      name: row.name,
      variantCount: row.variantCount,
      primaryImageFileId: row.primaryImageFileId,
    }));
  }, [productsQuery.data]);

  const thumbnailsByProductId = useMemo(() => {
    const map = new Map<string, OrderFormThumbnail>();
    for (const row of productRows) {
      const fileId = canFetchThumbnails ? row.primaryImageFileId : null;
      map.set(
        row.id,
        orderThumbnailView({
          fileId,
          url: fileId === null ? undefined : urlsByFileId.get(fileId),
          downloadFailed: fileId !== null && failedFileIds.has(fileId),
        }),
      );
    }
    return map;
  }, [canFetchThumbnails, failedFileIds, productRows, urlsByFileId]);

  const variantOptions = useMemo(() => {
    if (productQuery.data === undefined) {
      return [];
    }
    return optionSelectItems(
      productQuery.data.variants
        .filter((variant) => variant.status === "active")
        .map((variant) => ({
          id: variant.id,
          name: variant.name,
        })),
    );
  }, [productQuery.data]);

  return {
    customerOptions,
    productRows,
    variantOptions,
    variantsStatus:
      args.variantProductId === null
        ? "idle"
        : productQuery.status === "pending"
          ? "loading"
          : productQuery.status === "error"
            ? "error"
            : "ready",
    thumbnailsByProductId,
  };
}
