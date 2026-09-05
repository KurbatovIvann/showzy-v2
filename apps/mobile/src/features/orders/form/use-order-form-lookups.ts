import { useInfiniteQuery, useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  catalogFactsFromProduct,
  overlayCatalogVariantCount,
  uniqueProductIds,
  type OrderLineCatalogFacts,
  type OrderLineCatalogFactsMap,
} from "@showzy/validation/order-line-catalog-facts";

import { useApiClient } from "../../../api/api-provider";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { flattenPages, optionSelectItems } from "../../../components/ui";
import { useDrainInfinitePages } from "../../../hooks/use-drain-pages";
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
import {
  catalogFactsBlockSubmit,
  catalogQueryLoadStatus,
  classifyCatalogFactsLoad,
  type CatalogFactsLoadStatus,
  type CatalogFactsQuerySnapshot,
} from "./order-line-catalog-facts";
import type { ProductVariantsLoadStatus } from "./product-select";

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
  readonly draftProductIds: readonly string[];
}): {
  readonly customerOptions: ReturnType<typeof optionSelectItems>;
  readonly productRows: readonly OrderFormProductRow[];
  readonly variantOptions: ReturnType<typeof optionSelectItems>;
  readonly variantsStatus: ProductVariantsLoadStatus;
  readonly thumbnailsByProductId: ReadonlyMap<string, OrderFormThumbnail>;
  readonly catalogFacts: OrderLineCatalogFactsMap;
  readonly catalogFactsStatus: CatalogFactsLoadStatus;
  readonly catalogFactsPending: boolean;
} {
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;
  const enabled = args.enabled;
  const canFetchThumbnails = canFetchFileDownloadUrls(membership.role);
  const catalogProductIds = uniqueProductIds([
    ...args.draftProductIds,
    args.variantProductId,
  ]);

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

  const productQueries = useQueries({
    queries: catalogProductIds.map((productId) => {
      const options = getOrderCatalogProductQueryOptions({
        client: apiClient,
        companyId: activeCompanyId,
        productId,
        getActiveCompany,
      });
      return {
        ...options,
        enabled: options.enabled && enabled,
      };
    }),
  });

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

  const catalogFacts = useMemo((): OrderLineCatalogFactsMap => {
    const map = new Map<string, OrderLineCatalogFacts>();
    for (const [index, productId] of catalogProductIds.entries()) {
      const data = productQueries[index]?.data;
      if (data !== undefined) {
        map.set(productId, catalogFactsFromProduct(data));
      }
    }
    return map;
  }, [catalogProductIds, productQueries]);

  const draftCatalogIds = uniqueProductIds(args.draftProductIds);
  const catalogQueryByProductId = new Map<
    string,
    CatalogFactsQuerySnapshot | undefined
  >();
  for (const [index, productId] of catalogProductIds.entries()) {
    const query = productQueries[index];
    catalogQueryByProductId.set(
      productId,
      query === undefined ? undefined : { status: query.status },
    );
  }
  const catalogFactsStatus = classifyCatalogFactsLoad(
    draftCatalogIds,
    catalogQueryByProductId,
  );
  const catalogFactsPending = catalogFactsBlockSubmit(catalogFactsStatus);

  const productRows = useMemo((): readonly OrderFormProductRow[] => {
    if (productsQuery.data === undefined) {
      return [];
    }
    return flattenPages(productsQuery.data.pages).map((row) => ({
      id: row.id,
      name: row.name,
      variantCount: overlayCatalogVariantCount(
        row.variantCount,
        catalogFacts.get(row.id),
      ),
      primaryImageFileId: row.primaryImageFileId,
    }));
  }, [catalogFacts, productsQuery.data]);

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

  const pickerIndex =
    args.variantProductId === null
      ? -1
      : catalogProductIds.indexOf(args.variantProductId);
  const pickerQuery = pickerIndex < 0 ? undefined : productQueries[pickerIndex];

  const variantOptions = useMemo(() => {
    if (pickerQuery?.data === undefined) {
      return [];
    }
    return optionSelectItems(
      pickerQuery.data.variants
        .filter((variant) => variant.status === "active")
        .map((variant) => ({
          id: variant.id,
          name: variant.name,
        })),
    );
  }, [pickerQuery?.data]);

  return {
    customerOptions,
    productRows,
    variantOptions,
    variantsStatus:
      args.variantProductId === null
        ? "idle"
        : catalogQueryLoadStatus(
            pickerQuery === undefined
              ? undefined
              : { status: pickerQuery.status },
          ),
    thumbnailsByProductId,
    catalogFacts,
    catalogFactsStatus,
    catalogFactsPending,
  };
}
