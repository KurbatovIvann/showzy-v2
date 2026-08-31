import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";

import { useApiClient } from "../../../../api/api-provider";
import { describeQueryFailure } from "../../../../api/errors";
import { useActiveCompany } from "../../../../api/query-provider";
import { useResolvedCompany } from "../../../../company-resolution/resolved-company-provider";
import { detectLocale, interpolate } from "../../../../i18n/locale";
import { productsCopy } from "../../../../i18n/products";
import {
  listProductsInfiniteOptions,
  productsProbeQueryOptions,
  type ProductsStatusFilter,
} from "../api/product.queries";
import {
  canCreateProducts,
  canFetchFileDownloadUrls,
} from "../shared/product-permissions";
import { variantCountLabel } from "../shared/variant-count";
import {
  classifyProductsList,
  flattenProductPages,
  listProductsPageInput,
  normalizeProductsSearch,
  productsProbeState,
  toProductRowView,
  LIST_PRODUCTS_QUERY_MAX,
  type ProductsListState,
} from "./products-list.presenter";
import {
  SEARCH_DEBOUNCE_MS,
  useDebouncedValue,
} from "../../../../hooks/use-debounced-value";
import {
  resolveProductThumbnail,
  useProductThumbnails,
} from "./use-product-thumbnails";

export type ProductsListRow = {
  readonly id: string;
  readonly name: string;
  readonly priceLabel: string;
  readonly archived: boolean;
  readonly variantsLabel: string;
  readonly thumbnailFileId: string | null;
  readonly thumbnailUrl: string | null;
  readonly thumbnailFailed: boolean;
};

export function useProductsList() {
  const locale = detectLocale();
  const copy = useMemo(() => productsCopy(locale), [locale]);
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const router = useRouter();

  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<ProductsStatusFilter>("active");
  const debouncedSearch = useDebouncedValue(searchText, SEARCH_DEBOUNCE_MS);
  const search = normalizeProductsSearch(debouncedSearch);
  const hasSearch = search !== undefined;

  const getActiveCompany = useCallback(
    () => apiClient?.getActiveCompany() ?? null,
    [apiClient],
  );
  const listQuery = useInfiniteQuery(
    listProductsInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      input: listProductsPageInput(filter, search),
      getActiveCompany,
    }),
  );

  const probeEnabled =
    apiClient !== null &&
    activeCompanyId !== null &&
    listQuery.status === "success" &&
    !hasSearch &&
    filter === "active" &&
    flattenProductPages(listQuery.data.pages).length === 0;
  const probeQuery = useQuery({
    ...productsProbeQueryOptions({
      client: apiClient,
      companyId: activeCompanyId,
      getActiveCompany,
    }),
    enabled: probeEnabled,
    // Refetch whenever the probe is consulted: the default 60s staleTime
    // could otherwise pin yesterday's emptiness verdict onto today's
    // empty-state choice (Bugbot, PR #112).
    staleTime: 0,
  });

  const canFetchThumbnails = canFetchFileDownloadUrls(membership.role);
  const listPages = listQuery.data?.pages ?? [];
  const {
    urlsByFileId: thumbnailUrlsByFileId,
    failedFileIds: thumbnailFailedFileIds,
    refetch: refetchThumbnails,
  } = useProductThumbnails({
    client: apiClient,
    companyId: activeCompanyId,
    getActiveCompany,
    pages: listPages,
    enabled: canFetchThumbnails,
  });
  const rows = useMemo((): readonly ProductsListRow[] => {
    const pages = listQuery.data?.pages;
    if (pages === undefined) {
      return [];
    }
    return flattenProductPages(pages).map((item) => {
      const view = toProductRowView(item);
      const thumbnailFileId = canFetchThumbnails
        ? view.primaryImageFileId
        : null;
      const presentation = resolveProductThumbnail({
        fileId: thumbnailFileId,
        url:
          thumbnailFileId === null
            ? undefined
            : thumbnailUrlsByFileId.get(thumbnailFileId),
        downloadFailed:
          thumbnailFileId !== null &&
          thumbnailFailedFileIds.has(thumbnailFileId),
      });
      return {
        id: view.id,
        name: view.name,
        priceLabel: view.priceLabel,
        archived: view.archived,
        variantsLabel: variantCountLabel(
          view.variantCount,
          locale,
          copy.variants,
        ),
        thumbnailFileId,
        thumbnailUrl: presentation.kind === "ready" ? presentation.url : null,
        thumbnailFailed: presentation.kind === "failed",
      };
    });
  }, [
    listQuery.data?.pages,
    locale,
    copy,
    canFetchThumbnails,
    thumbnailUrlsByFileId,
    thumbnailFailedFileIds,
  ]);

  const failureKind = listQuery.isError
    ? describeQueryFailure(listQuery.error).kind
    : null;
  const state: ProductsListState = classifyProductsList({
    clientReady: apiClient !== null && activeCompanyId !== null,
    status: listQuery.status,
    failureKind,
    rowCount: rows.length,
    hasSearch,
    filter,
    probe: productsProbeState({
      enabled: probeEnabled,
      status: probeQuery.status,
      itemCount: probeQuery.data?.items.length,
    }),
  });

  const foundCountLabel = interpolate(copy.foundCount, {
    count: String(rows.length),
  });
  const resetSearch = useCallback(() => {
    setSearchText("");
  }, []);
  const showAll = useCallback(() => {
    setFilter("all");
  }, []);
  const listRefetch = listQuery.refetch;
  const fetchNextPage = listQuery.fetchNextPage;
  const hasNextPage = listQuery.hasNextPage;
  const isFetchingNextPage = listQuery.isFetchingNextPage;
  const refresh = useCallback(() => {
    void listRefetch();
    refetchThumbnails();
  }, [listRefetch, refetchThumbnails]);
  const retry = useCallback(() => {
    void listRefetch();
    refetchThumbnails();
  }, [listRefetch, refetchThumbnails]);
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  const openProduct = useCallback(
    (id: string) => {
      router.push(`/products/${id}`);
    },
    [router],
  );
  const openCreate = useCallback(() => {
    router.push("/products/new");
  }, [router]);

  return {
    copy,
    state,
    rows,
    // Loaded-page size only (SHO-149 owner: no catalog.listProducts activeCount).
    foundCountLabel,
    searchText,
    searchMaxLength: LIST_PRODUCTS_QUERY_MAX,
    changeSearch: setSearchText,
    resetSearch,
    filter,
    changeFilter: setFilter,
    showAll,
    canCreate: canCreateProducts(membership.role),
    refreshing: listQuery.isRefetching && !listQuery.isFetchingNextPage,
    refresh,
    retry,
    loadingMore: listQuery.isFetchingNextPage,
    loadMore,
    openProduct,
    openCreate,
  };
}

export type ProductsListModel = ReturnType<typeof useProductsList>;
