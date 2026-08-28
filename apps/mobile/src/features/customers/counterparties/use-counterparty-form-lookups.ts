import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useActiveCompany } from "../../../api/query-provider";
import { listCustomersInfiniteOptions } from "../api/customer.queries";
import { optionSelectItems } from "../form/customer-form-pickers";
import { CUSTOMERS_LOOKUP_PAGE_SIZE } from "../shared/customer-caps";
import type { OptionSelectItem } from "../shared/option-select";
import { flattenPages, nameById } from "../shared/paged-list";
import { useDrainInfinitePages } from "../shared/use-drain-pages";

/**
 * Active-customer picker options for the counterparty form. Keep already
 * fetched pages on error. Does not import `list/`.
 */
export function useCounterpartyFormLookups(args: {
  readonly enabled: boolean;
}): {
  readonly customerOptions: readonly OptionSelectItem[];
  readonly customerNameById: ReadonlyMap<string, string>;
} {
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;

  const customersQuery = useInfiniteQuery(
    listCustomersInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      input: { status: "active", limit: CUSTOMERS_LOOKUP_PAGE_SIZE },
      getActiveCompany,
      enabled: args.enabled,
    }),
  );
  useDrainInfinitePages({
    status: customersQuery.status,
    hasNextPage: customersQuery.hasNextPage,
    isFetchingNextPage: customersQuery.isFetchingNextPage,
    fetchNextPage: customersQuery.fetchNextPage,
  });

  const customers = useMemo(() => {
    if (customersQuery.data === undefined) {
      return [];
    }
    return flattenPages(customersQuery.data.pages);
  }, [customersQuery.data]);

  const customerOptions = useMemo(
    () =>
      optionSelectItems(
        customers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          description: customer.phone,
        })),
      ),
    [customers],
  );
  const customerNameById = useMemo(() => nameById(customers), [customers]);

  return {
    customerOptions,
    customerNameById,
  };
}
