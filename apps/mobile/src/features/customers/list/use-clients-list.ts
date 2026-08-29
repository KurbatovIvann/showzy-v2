import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import type { CustomersCopy } from "../../../i18n/customers";
import { interpolate, type Locale } from "../../../i18n/locale";
import {
  customersProbeQueryOptions,
  listCustomersInfiniteOptions,
} from "../api/customer.queries";
import type { GroupListItem } from "../api/group.queries";
import { counterpartyCountLabel } from "../shared/counterparty-count";
import { LIST_CUSTOMERS_SEARCH_MAX } from "../shared/customer-caps";
import {
  SEARCH_DEBOUNCE_MS,
  useDebouncedValue,
} from "../../../hooks/use-debounced-value";
import {
  classifyClientsList,
  clientsChipKey,
  flattenPages,
  groupChipOptions,
  listCustomersPageInput,
  normalizeCustomersSearch,
  parseClientsChipKey,
  shouldResetMissingGroupFilter,
  toClientRowView,
  customersProbeState,
  type ClientsFilter,
  type ClientsListState,
} from "./clients-list.presenter";
import { useClientWrites } from "./use-client-writes";

export type ClientsListRow = {
  readonly id: string;
  readonly name: string;
  readonly archived: boolean;
  readonly groupName: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly priceListName: string | null;
  readonly counterpartiesLabel: string | null;
  readonly archiveA11y: string;
  readonly deleteA11y: string;
};

export function useClientsList(args: {
  readonly copy: CustomersCopy;
  readonly locale: Locale;
  readonly groups: readonly GroupListItem[];
  readonly groupsById: ReadonlyMap<string, string>;
  readonly priceListsById: ReadonlyMap<string, string>;
  readonly groupsLookupSettled: boolean;
  readonly canCreate: boolean;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
}) {
  const { copy, locale } = args;
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const writes = useClientWrites({
    copy,
    canEdit: args.canEdit,
    canDelete: args.canDelete,
  });

  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<ClientsFilter>({ kind: "all" });
  const debouncedSearch = useDebouncedValue(searchText, SEARCH_DEBOUNCE_MS);
  const search = normalizeCustomersSearch(
    debouncedSearch,
    LIST_CUSTOMERS_SEARCH_MAX,
  );
  const hasSearch = search !== undefined;

  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;
  const listQuery = useInfiniteQuery(
    listCustomersInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      input: listCustomersPageInput(filter, search),
      getActiveCompany,
    }),
  );

  const probeEnabled =
    apiClient !== null &&
    activeCompanyId !== null &&
    listQuery.status === "success" &&
    !hasSearch &&
    filter.kind === "all" &&
    flattenPages(listQuery.data.pages).length === 0;
  const probeQuery = useQuery({
    ...customersProbeQueryOptions({
      client: apiClient,
      companyId: activeCompanyId,
      getActiveCompany,
    }),
    enabled: probeEnabled,
    staleTime: 0,
  });

  useEffect(() => {
    if (
      !shouldResetMissingGroupFilter({
        filter,
        groupIds: args.groups.map((group) => group.id),
        lookupSettled: args.groupsLookupSettled,
      })
    ) {
      return;
    }
    setFilter({ kind: "all" });
  }, [args.groups, args.groupsLookupSettled, filter]);

  const rows = useMemo((): readonly ClientsListRow[] => {
    const pages = listQuery.data?.pages;
    if (pages === undefined) {
      return [];
    }
    return flattenPages(pages).map((item) => {
      const view = toClientRowView(item, args.groupsById, args.priceListsById);
      return {
        ...view,
        counterpartiesLabel: counterpartyCountLabel(
          view.linkedCounterpartyCount,
          locale,
          copy.counterparties,
        ),
        archiveA11y: interpolate(copy.archiveLabel, { name: view.name }),
        deleteA11y: interpolate(copy.deleteLabel, { name: view.name }),
      };
    });
  }, [
    listQuery.data?.pages,
    args.groupsById,
    args.priceListsById,
    locale,
    copy,
  ]);

  const failureKind = listQuery.isError
    ? describeQueryFailure(listQuery.error).kind
    : null;
  const state: ClientsListState = classifyClientsList({
    clientReady: apiClient !== null && activeCompanyId !== null,
    status: listQuery.status,
    failureKind,
    rowCount: rows.length,
    hasSearch,
    filter,
    probe: customersProbeState({
      enabled: probeEnabled,
      status: probeQuery.status,
      itemCount: probeQuery.data?.items.length,
    }),
  });

  const chipOptions = groupChipOptions(args.groups, copy.filters);

  return {
    copy,
    state,
    rows,
    searchText,
    searchMaxLength: LIST_CUSTOMERS_SEARCH_MAX,
    changeSearch: setSearchText,
    resetFilters: () => {
      setSearchText("");
      setFilter({ kind: "all" });
    },
    filter,
    chipKey: clientsChipKey(filter),
    chipOptions,
    changeChip: (key: string) => {
      setFilter(parseClientsChipKey(key));
    },
    showArchived: () => {
      setFilter({ kind: "archived" });
    },
    canCreate: args.canCreate,
    canEdit: args.canEdit,
    canDelete: args.canDelete,
    banner: writes.banner,
    writesPending: writes.pending,
    openEdit: writes.openEdit,
    archive: writes.archive,
    restore: writes.restore,
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

export type ClientsListModel = ReturnType<typeof useClientsList>;
