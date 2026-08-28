import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useActiveCompany } from "../../../api/query-provider";
import { listGroupsInfiniteOptions } from "../api/group.queries";
import { listPriceListsInfiniteOptions } from "../api/price-list.queries";
import { CUSTOMERS_LOOKUP_PAGE_SIZE } from "../shared/customer-caps";
import type { OptionSelectItem } from "../shared/option-select";
import { flattenPages, nameById } from "../shared/paged-list";
import { useDrainInfinitePages } from "../shared/use-drain-pages";
import { optionSelectItems } from "./customer-form-pickers";

/**
 * Group and price-list picker options for the client form. Keep already
 * fetched pages on error (same as the list). Does not import `list/`.
 */
export function useCustomerFormLookups(args: { readonly enabled: boolean }): {
  readonly groupOptions: readonly OptionSelectItem[];
  readonly priceListOptions: readonly OptionSelectItem[];
  readonly groupNameById: ReadonlyMap<string, string>;
  readonly priceListNameById: ReadonlyMap<string, string>;
  readonly priceListIdByGroupId: ReadonlyMap<string, string | null>;
} {
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;
  const enabled = args.enabled;

  const groupsQuery = useInfiniteQuery(
    listGroupsInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      input: { limit: CUSTOMERS_LOOKUP_PAGE_SIZE },
      getActiveCompany,
      enabled,
    }),
  );
  useDrainInfinitePages({
    status: groupsQuery.status,
    hasNextPage: groupsQuery.hasNextPage,
    isFetchingNextPage: groupsQuery.isFetchingNextPage,
    fetchNextPage: groupsQuery.fetchNextPage,
  });

  const priceListsQuery = useInfiniteQuery(
    listPriceListsInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      input: { limit: CUSTOMERS_LOOKUP_PAGE_SIZE },
      getActiveCompany,
      enabled,
    }),
  );
  useDrainInfinitePages({
    status: priceListsQuery.status,
    hasNextPage: priceListsQuery.hasNextPage,
    isFetchingNextPage: priceListsQuery.isFetchingNextPage,
    fetchNextPage: priceListsQuery.fetchNextPage,
  });

  const groups = useMemo(() => {
    if (groupsQuery.data === undefined) {
      return [];
    }
    return flattenPages(groupsQuery.data.pages);
  }, [groupsQuery.data]);

  const priceLists = useMemo(() => {
    if (priceListsQuery.data === undefined) {
      return [];
    }
    return flattenPages(priceListsQuery.data.pages);
  }, [priceListsQuery.data]);

  const groupOptions = useMemo(() => optionSelectItems(groups), [groups]);
  const priceListOptions = useMemo(
    () => optionSelectItems(priceLists),
    [priceLists],
  );
  const groupNameById = useMemo(() => nameById(groups), [groups]);
  const priceListNameById = useMemo(() => nameById(priceLists), [priceLists]);
  const priceListIdByGroupId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const group of groups) {
      map.set(group.id, group.priceListId);
    }
    return map;
  }, [groups]);

  return {
    groupOptions,
    priceListOptions,
    groupNameById,
    priceListNameById,
    priceListIdByGroupId,
  };
}
