import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import {
  SEARCH_DEBOUNCE_MS,
  useDebouncedValue,
} from "../../../hooks/use-debounced-value";
import { detectLocale } from "../../../i18n/locale";
import { ordersCopy } from "../../../i18n/orders";
import {
  listOrdersInfiniteOptions,
  type OrderListItem,
} from "../api/order.queries";
import {
  canCreateOrders,
  ordersHeaderActions,
} from "../shared/order-permissions";
import { orderCreateHref, orderDetailHref } from "../shared/order-hrefs";
import {
  classifyOrdersList,
  filterOrdersBySelectedStatuses,
  flattenOrderPages,
  groupOrderRows,
  hasActiveStatusFilter,
  listOrdersPageInput,
  normalizeOrdersSearch,
  shouldPageThroughClientStatusFilter,
  stickyHeaderIndices,
  toggleOrderStatusFilter,
  toOrderRowView,
  LIST_ORDERS_QUERY_MAX,
  type OrderStatusFilter,
  type OrdersListState,
} from "./orders-list.presenter";
import { useOrderCustomerNames } from "./use-order-customer-names";

const EMPTY_ORDER_PAGES: ReadonlyArray<{
  readonly items: readonly OrderListItem[];
}> = [];

export type OrdersListChip = {
  readonly key: OrderStatusFilter;
  readonly label: string;
};

export function useOrdersList() {
  const locale = detectLocale();
  const copy = useMemo(() => ordersCopy(locale), [locale]);
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const router = useRouter();
  const canCreate = canCreateOrders(membership.role);
  const { showCreate } = ordersHeaderActions({ canCreate });

  const [selectedStatuses, setSelectedStatuses] = useState<
    readonly OrderStatusFilter[]
  >([]);
  const [searchText, setSearchText] = useState("");
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const debouncedSearch = useDebouncedValue(searchText, SEARCH_DEBOUNCE_MS);
  const search = normalizeOrdersSearch(debouncedSearch);
  const hasSearch = search !== undefined;

  const getActiveCompany = useCallback(
    () => apiClient?.getActiveCompany() ?? null,
    [apiClient],
  );
  const listQuery = useInfiniteQuery(
    listOrdersInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      input: listOrdersPageInput(selectedStatuses, search),
      getActiveCompany,
    }),
  );

  const listItems = useMemo(
    () => flattenOrderPages(listQuery.data?.pages ?? EMPTY_ORDER_PAGES),
    [listQuery.data?.pages],
  );
  const { hydrationByCustomerId, refetch: refetchNames } =
    useOrderCustomerNames({
      client: apiClient,
      companyId: activeCompanyId,
      getActiveCompany,
      items: listItems,
    });

  const rows = useMemo(() => {
    return filterOrdersBySelectedStatuses(listItems, selectedStatuses).map(
      (entry) =>
        toOrderRowView(entry, {
          locale,
          copy,
          customerName:
            entry.customerId === null
              ? { kind: "missing" }
              : (hydrationByCustomerId.get(entry.customerId) ?? {
                  kind: "pending",
                }),
        }),
    );
  }, [copy, hydrationByCustomerId, listItems, locale, selectedStatuses]);

  const entries = useMemo(() => groupOrderRows(rows), [rows]);
  const headerIndices = useMemo(() => stickyHeaderIndices(entries), [entries]);
  const failureKind = listQuery.isError
    ? describeQueryFailure(listQuery.error).kind
    : null;
  const hasStatusFilter = hasActiveStatusFilter(selectedStatuses);
  const {
    status: listStatus,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = listQuery;
  const state: OrdersListState = classifyOrdersList({
    clientReady: apiClient !== null && activeCompanyId !== null,
    status: listStatus,
    failureKind,
    rowCount: rows.length,
    hasStatusFilter,
    hasSearch,
    hasNextPage,
    isFetchingNextPage,
  });

  useEffect(() => {
    if (
      !shouldPageThroughClientStatusFilter({
        selectedCount: selectedStatuses.length,
        matchingRowCount: rows.length,
        status: listStatus,
        hasNextPage,
        isFetchingNextPage,
      })
    ) {
      return;
    }
    void fetchNextPage();
  }, [
    selectedStatuses.length,
    rows.length,
    listStatus,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  const selectedFilterChips: readonly OrdersListChip[] = selectedStatuses.map(
    (status) => ({
      key: status,
      label: copy.statuses[status],
    }),
  );
  const listRefetch = listQuery.refetch;
  const openFilters = useCallback(() => {
    setFilterSheetVisible(true);
  }, []);
  const closeFilters = useCallback(() => {
    setFilterSheetVisible(false);
  }, []);
  const toggleStatus = useCallback((status: OrderStatusFilter) => {
    setSelectedStatuses((current) => toggleOrderStatusFilter(current, status));
  }, []);
  const resetFilters = useCallback(() => {
    setSelectedStatuses([]);
  }, []);
  const resetSearchAndFilters = useCallback(() => {
    setSearchText("");
    setSelectedStatuses([]);
  }, []);
  const refresh = useCallback(() => {
    void listRefetch();
    refetchNames();
  }, [listRefetch, refetchNames]);
  const retry = useCallback(() => {
    void listRefetch();
    refetchNames();
  }, [listRefetch, refetchNames]);
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  const openOrder = useCallback(
    (id: string) => {
      router.push(orderDetailHref(id));
    },
    [router],
  );
  const openCreate = useCallback(() => {
    router.push(orderCreateHref());
  }, [router]);

  return {
    copy,
    companyName: membership.company.name,
    state,
    entries,
    stickyHeaderIndices: headerIndices,
    searchText,
    searchMaxLength: LIST_ORDERS_QUERY_MAX,
    changeSearch: setSearchText,
    selectedStatuses,
    selectedFilterChips,
    filterCount: selectedStatuses.length,
    filterSheetVisible,
    openFilters,
    closeFilters,
    toggleStatus,
    resetFilters,
    resetSearchAndFilters,
    showCreate,
    refreshing: listQuery.isRefetching && !listQuery.isFetchingNextPage,
    refresh,
    retry,
    loadingMore: listQuery.isFetchingNextPage,
    loadMore,
    openOrder,
    openCreate,
  };
}

export type OrdersListModel = ReturnType<typeof useOrdersList>;
