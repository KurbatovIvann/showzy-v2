import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { detectLocale, interpolate } from "../../../i18n/locale";
import { productsCopy } from "../../../i18n/products";
import {
  canCreateProducts,
  canFetchFileDownloadUrls,
} from "./product-permissions";
import {
  classifyProductsList,
  flattenProductPages,
  listProductsPageInput,
  normalizeProductsSearch,
  productsProbeState,
  toProductRowView,
  PRODUCTS_SEARCH_MAX_LENGTH,
  type ProductsListState,
} from "./products-list-model";
import {
  listProductsInfiniteOptions,
  productsProbeQueryOptions,
  type ProductsStatusFilter,
} from "./products-list-query";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "./use-debounced-value";
import { variantCountLabel } from "./variant-count";

export type ProductsListRow = {
  readonly id: string;
  readonly name: string;
  readonly priceLabel: string;
  readonly archived: boolean;
  readonly variantsLabel: string;
  readonly thumbnailFileId: string | null;
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

  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;
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
  const rows = useMemo((): readonly ProductsListRow[] => {
    const pages = listQuery.data?.pages;
    if (pages === undefined) {
      return [];
    }
    return flattenProductPages(pages).map((item) => {
      const view = toProductRowView(item);
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
        thumbnailFileId: canFetchThumbnails ? view.primaryImageFileId : null,
      };
    });
  }, [listQuery.data?.pages, locale, copy, canFetchThumbnails]);

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

  return {
    copy,
    state,
    rows,
    foundCountLabel: interpolate(copy.foundCount, {
      count: String(rows.length),
    }),
    searchText,
    searchMaxLength: PRODUCTS_SEARCH_MAX_LENGTH,
    changeSearch: setSearchText,
    resetSearch: () => {
      setSearchText("");
    },
    filter,
    changeFilter: setFilter,
    showAll: () => {
      setFilter("all");
    },
    canCreate: canCreateProducts(membership.role),
    refreshing: listQuery.isRefetching && !listQuery.isFetchingNextPage,
    refresh: () => {
      void listQuery.refetch();
    },
    retry: () => {
      void listQuery.refetch();
    },
    loadingMore: listQuery.isFetchingNextPage,
    loadMore: () => {
      if (listQuery.hasNextPage && !listQuery.isFetchingNextPage) {
        void listQuery.fetchNextPage();
      }
    },
    openProduct: (id: string) => {
      router.push(`/products/${id}`);
    },
    openCreate: () => {
      router.push("/products/new");
    },
  };
}

export type ProductsListModel = ReturnType<typeof useProductsList>;
