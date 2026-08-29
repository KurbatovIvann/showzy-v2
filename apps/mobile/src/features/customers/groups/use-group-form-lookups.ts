import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useActiveCompany } from "../../../api/query-provider";
import { listPriceListsInfiniteOptions } from "../api/price-list.queries";
import { CUSTOMERS_LOOKUP_PAGE_SIZE } from "../shared/customer-caps";
import {
  optionSelectItems,
  type OptionSelectItem,
} from "../shared/option-select";
import { flattenPages, nameById } from "../shared/paged-list";
import { useDrainInfinitePages } from "../shared/use-drain-pages";

/**
 * Price-list picker options for the group form. Reuses the picker-safe
 * `pricing.listPriceLists` drain. Keep already fetched pages on error.
 * Does not import `list/` or `form/`.
 */
export function useGroupFormLookups(args: { readonly enabled: boolean }): {
  readonly priceListOptions: readonly OptionSelectItem[];
  readonly priceListNameById: ReadonlyMap<string, string>;
} {
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;

  const priceListsQuery = useInfiniteQuery(
    listPriceListsInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      input: { limit: CUSTOMERS_LOOKUP_PAGE_SIZE },
      getActiveCompany,
      enabled: args.enabled,
    }),
  );
  useDrainInfinitePages({
    status: priceListsQuery.status,
    hasNextPage: priceListsQuery.hasNextPage,
    isFetchingNextPage: priceListsQuery.isFetchingNextPage,
    fetchNextPage: priceListsQuery.fetchNextPage,
  });

  const priceLists = useMemo(() => {
    if (priceListsQuery.data === undefined) {
      return [];
    }
    return flattenPages(priceListsQuery.data.pages);
  }, [priceListsQuery.data]);

  const priceListOptions = useMemo(
    () => optionSelectItems(priceLists),
    [priceLists],
  );
  const priceListNameById = useMemo(() => nameById(priceLists), [priceLists]);

  return {
    priceListOptions,
    priceListNameById,
  };
}
