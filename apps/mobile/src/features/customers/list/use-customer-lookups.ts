import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useActiveCompany } from "../../../api/query-provider";
import { useDrainInfinitePages } from "../../../hooks/use-drain-pages";
import { listGroupsInfiniteOptions } from "../api/group.queries";
import { listPriceListsInfiniteOptions } from "../api/price-list.queries";
import { CUSTOMERS_LOOKUP_PAGE_SIZE } from "../shared/customer-caps";
import {
  flattenGroupPages,
  flattenPriceListPages,
  nameById,
} from "./clients-list.presenter";
import { lookupPagesSettled } from "./customers-home.presenter";

/**
 * Unfiltered groups (chips) and price-list names. Failures degrade to
 * empty maps so the clients list still renders.
 */
export function useCustomerLookups() {
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;

  const groupsQuery = useInfiniteQuery(
    listGroupsInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      input: { limit: CUSTOMERS_LOOKUP_PAGE_SIZE },
      getActiveCompany,
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
    return flattenGroupPages(groupsQuery.data.pages);
  }, [groupsQuery.data]);

  const groupsById = useMemo(() => nameById(groups), [groups]);
  const priceListsById = useMemo(() => {
    if (priceListsQuery.data === undefined) {
      return nameById([]);
    }
    return nameById(flattenPriceListPages(priceListsQuery.data.pages));
  }, [priceListsQuery.data]);

  return {
    groups,
    groupsById,
    priceListsById,
    groupsLookupSettled: lookupPagesSettled({
      status: groupsQuery.status,
      hasNextPage: groupsQuery.hasNextPage,
      isFetchingNextPage: groupsQuery.isFetchingNextPage,
    }),
  };
}
