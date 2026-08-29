import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { detectLocale } from "../../../i18n/locale";
import { ordersCopy } from "../../../i18n/orders";
import { listOrdersInfiniteOptions } from "../api/order.queries";
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
  shouldPageThroughClientStatusFilter,
  stickyHeaderIndices,
  toggleOrderStatusFilter,
  toOrderRowView,
  type OrderStatusFilter,
  type OrdersListState,
} from "./orders-list.presenter";
import { useOrderCustomerNames } from "./use-order-customer-names";

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
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;
  const listQuery = useInfiniteQuery(
    listOrdersInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      input: listOrdersPageInput(selectedStatuses),
      getActiveCompany,
    }),
  );

  const listItems = useMemo(
    () => flattenOrderPages(listQuery.data?.pages ?? []),
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

  return {
    copy,
    state,
    entries,
    stickyHeaderIndices: headerIndices,
    selectedStatuses,
    selectedFilterChips,
    filterCount: selectedStatuses.length,
    filterSheetVisible,
    openFilters: () => {
      setFilterSheetVisible(true);
    },
    closeFilters: () => {
      setFilterSheetVisible(false);
    },
    toggleStatus: (status: OrderStatusFilter) => {
      setSelectedStatuses((current) =>
        toggleOrderStatusFilter(current, status),
      );
    },
    resetFilters: () => {
      setSelectedStatuses([]);
    },
    showCreate,
    refreshing: listQuery.isRefetching && !listQuery.isFetchingNextPage,
    refresh: () => {
      void listQuery.refetch();
      refetchNames();
    },
    retry: () => {
      void listQuery.refetch();
      refetchNames();
    },
    loadingMore: listQuery.isFetchingNextPage,
    loadMore: () => {
      if (listQuery.hasNextPage && !listQuery.isFetchingNextPage) {
        void listQuery.fetchNextPage();
      }
    },
    openOrder: (id: string) => {
      router.push(orderDetailHref(id));
    },
    openCreate: () => {
      router.push(orderCreateHref());
    },
  };
}

export type OrdersListModel = ReturnType<typeof useOrdersList>;
