import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import type { CustomersCopy } from "../../../i18n/customers";
import { interpolate } from "../../../i18n/locale";
import { listCounterpartiesInfiniteOptions } from "../api/counterparty.queries";
import { LIST_COUNTERPARTIES_SEARCH_MAX } from "../shared/customer-caps";
import {
  SEARCH_DEBOUNCE_MS,
  useDebouncedValue,
} from "../shared/use-debounced-value";
import {
  classifyCounterpartiesList,
  flattenCounterpartyListPages,
  listCounterpartiesPageInput,
  normalizeCustomersSearch,
  toCounterpartyRowView,
  type CounterpartiesListState,
} from "./counterparties-list.presenter";
import { useCounterpartyWrites } from "./use-counterparty-writes";

export type CounterpartiesListRow = {
  readonly id: string;
  readonly name: string;
  readonly edrpouLabel: string | null;
  readonly customerName: string | null;
  readonly deleteA11y: string;
};

export function useCounterpartiesList(args: {
  readonly copy: CustomersCopy;
  readonly canCreate: boolean;
  readonly canEdit: boolean;
}) {
  const { copy } = args;
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const writes = useCounterpartyWrites({
    copy,
    canEdit: args.canEdit,
  });

  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebouncedValue(searchText, SEARCH_DEBOUNCE_MS);
  const search = normalizeCustomersSearch(
    debouncedSearch,
    LIST_COUNTERPARTIES_SEARCH_MAX,
  );
  const hasSearch = search !== undefined;

  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;
  const listQuery = useInfiniteQuery(
    listCounterpartiesInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      input: listCounterpartiesPageInput(search),
      getActiveCompany,
    }),
  );

  const rows = useMemo((): readonly CounterpartiesListRow[] => {
    const pages = listQuery.data?.pages;
    if (pages === undefined) {
      return [];
    }
    return flattenCounterpartyListPages(pages).map((item) => {
      const view = toCounterpartyRowView(item);
      return {
        id: view.id,
        name: view.name,
        edrpouLabel:
          view.edrpou === null
            ? null
            : interpolate(copy.edrpouBadge, { edrpou: view.edrpou }),
        customerName:
          view.customerId === null ||
          view.customerName === null ||
          view.customerName.length === 0
            ? null
            : view.customerName,
        deleteA11y: interpolate(copy.deleteLabel, { name: view.name }),
      };
    });
  }, [listQuery.data?.pages, copy]);

  const failureKind = listQuery.isError
    ? describeQueryFailure(listQuery.error).kind
    : null;
  const state: CounterpartiesListState = classifyCounterpartiesList({
    clientReady: apiClient !== null && activeCompanyId !== null,
    status: listQuery.status,
    failureKind,
    rowCount: rows.length,
    hasSearch,
  });

  return {
    copy,
    state,
    rows,
    searchText,
    searchMaxLength: LIST_COUNTERPARTIES_SEARCH_MAX,
    changeSearch: setSearchText,
    resetSearch: () => {
      setSearchText("");
    },
    canCreate: args.canCreate,
    canEdit: args.canEdit,
    banner: writes.banner,
    writesPending: writes.pending,
    openEdit: writes.openEdit,
    remove: writes.remove,
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
  };
}

export type CounterpartiesListModel = ReturnType<typeof useCounterpartiesList>;
