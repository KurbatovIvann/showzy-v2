import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { detectLocale, interpolate } from "../../../i18n/locale";
import { pricingCopy } from "../../../i18n/pricing";
import {
  listPriceListsInfiniteOptions,
  type PriceListsAvailability,
} from "../api/price-list.queries";
import { entryCountLabel } from "../shared/entry-count";
import { canManagePriceLists } from "../shared/price-list-permissions";
import {
  SEARCH_DEBOUNCE_MS,
  useDebouncedValue,
} from "../shared/use-debounced-value";
import { useSheetHiddenWaiter } from "../shared/use-sheet-hidden-waiter";
import {
  optionsFollowUpWaitsForHidden,
  planPriceListOptionsFollowUp,
  runAfterOptionsSheetHidden,
} from "./price-list-options-handshake";
import {
  classifyPriceListsList,
  flattenPriceListPages,
  listPriceListsPageInput,
  normalizePriceListsSearch,
  shouldShowPriceListsHint,
  toPriceListRowView,
  LIST_PRICE_LISTS_QUERY_MAX,
  type PriceListsListState,
} from "./price-lists-list.presenter";
import { usePriceListWrites } from "./use-price-list-writes";

export type PriceListsListRow = {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly isActive: boolean;
  readonly pricesLabel: string;
  readonly optionsA11y: string;
};

export function usePriceListsList() {
  const locale = detectLocale();
  const copy = useMemo(() => pricingCopy(locale), [locale]);
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const canManage = canManagePriceLists(membership.role);
  const writes = usePriceListWrites({ copy, canManage });

  const [searchText, setSearchText] = useState("");
  const [availability, setAvailability] =
    useState<PriceListsAvailability>("all");
  const [optionsListId, setOptionsListId] = useState<string | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const optionsVisibleRef = useRef(false);
  const optionsHidden = useSheetHiddenWaiter();
  const debouncedSearch = useDebouncedValue(searchText, SEARCH_DEBOUNCE_MS);
  const search = normalizePriceListsSearch(debouncedSearch);
  const hasSearch = search !== undefined;

  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;
  const listQuery = useInfiniteQuery(
    listPriceListsInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      input: listPriceListsPageInput(availability, search),
      getActiveCompany,
    }),
  );

  const rows = useMemo((): readonly PriceListsListRow[] => {
    const pages = listQuery.data?.pages;
    if (pages === undefined) {
      return [];
    }
    return flattenPriceListPages(pages).map((item) => {
      const view = toPriceListRowView(item);
      return {
        id: view.id,
        name: view.name,
        isDefault: view.isDefault,
        isActive: view.isActive,
        pricesLabel: entryCountLabel(view.entryCount, locale, copy.prices),
        optionsA11y: interpolate(copy.optionsLabel, { name: view.name }),
      };
    });
  }, [listQuery.data?.pages, locale, copy]);

  const failureKind = listQuery.isError
    ? describeQueryFailure(listQuery.error).kind
    : null;
  const state: PriceListsListState = classifyPriceListsList({
    clientReady: apiClient !== null && activeCompanyId !== null,
    status: listQuery.status,
    failureKind,
    rowCount: rows.length,
    hasSearch,
    availability,
  });
  const optionsList = rows.find((row) => row.id === optionsListId) ?? null;

  function setOptionsOpen(visible: boolean): void {
    optionsVisibleRef.current = visible;
    setOptionsVisible(visible);
  }

  function hideOptions(): void {
    setOptionsOpen(false);
  }

  const showHint =
    state.kind === "rows" &&
    shouldShowPriceListsHint({
      rowCount: rows.length,
      hasNextPage: listQuery.hasNextPage,
      hasSearch,
      availability,
    });

  return {
    copy,
    state,
    rows,
    searchText,
    searchMaxLength: LIST_PRICE_LISTS_QUERY_MAX,
    changeSearch: setSearchText,
    resetFilters: () => {
      setSearchText("");
      setAvailability("all");
    },
    availability,
    changeAvailability: setAvailability,
    canManage,
    banner: writes.banner,
    writesPending: writes.pending,
    showHint,
    optionsVisible,
    optionsList,
    openOptions: (id: string) => {
      setOptionsListId(id);
      setOptionsOpen(true);
    },
    closeOptions: () => {
      hideOptions();
    },
    onOptionsHidden: () => {
      optionsHidden.notify();
      if (!optionsVisibleRef.current) {
        setOptionsListId(null);
      }
    },
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
    goBack: writes.goBack,
    openCreate: writes.openCreate,
    openEdit: writes.openEdit,
    setDefault: async () => {
      if (optionsList === null) {
        return;
      }
      const list = optionsList;
      hideOptions();
      await writes.setDefault(list);
    },
    toggleActive: async () => {
      if (optionsList === null) {
        return;
      }
      const list = optionsList;
      const followUp = planPriceListOptionsFollowUp({
        action: "toggleActive",
        isDefault: list.isDefault,
        isActive: list.isActive,
      });
      if (optionsFollowUpWaitsForHidden(followUp)) {
        await runAfterOptionsSheetHidden({
          waitHidden: optionsHidden.wait,
          hide: hideOptions,
          then: () => writes.toggleActive(list),
        });
        return;
      }
      hideOptions();
      await writes.toggleActive(list);
    },
    remove: async () => {
      if (optionsList === null) {
        return;
      }
      const list = optionsList;
      await runAfterOptionsSheetHidden({
        waitHidden: optionsHidden.wait,
        hide: hideOptions,
        then: () => writes.remove(list),
      });
    },
  };
}

export type PriceListsListModel = ReturnType<typeof usePriceListsList>;
