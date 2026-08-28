import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useActiveCompany } from "../../../api/query-provider";
import { listCounterpartiesInfiniteOptions } from "../api/counterparty.queries";
import { CUSTOMERS_LOOKUP_PAGE_SIZE } from "../shared/customer-caps";
import { flattenPages } from "../shared/paged-list";
import { useDrainInfinitePages } from "../shared/use-drain-pages";

export type LinkedCounterpartyRow = {
  readonly id: string;
  readonly name: string;
  readonly edrpou: string | null;
};

/**
 * Linked Юрособи for the client editor. Lives in `form/` so this
 * surface does not import `counterparties/`.
 */
export function useCustomerLinkedCounterparties(args: {
  readonly enabled: boolean;
  readonly customerId: string | null;
}): {
  readonly status: "idle" | "pending" | "error" | "success";
  readonly items: readonly LinkedCounterpartyRow[];
  readonly retry: () => void;
} {
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const customerId = args.customerId;
  const enabled = args.enabled && customerId !== null;

  const query = useInfiniteQuery(
    listCounterpartiesInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      input: {
        ...(customerId === null ? {} : { customerId }),
        limit: CUSTOMERS_LOOKUP_PAGE_SIZE,
      },
      getActiveCompany: () => apiClient?.getActiveCompany() ?? null,
      enabled,
    }),
  );
  useDrainInfinitePages({
    status: query.status,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  });

  const items = useMemo((): readonly LinkedCounterpartyRow[] => {
    if (query.data === undefined) {
      return [];
    }
    return flattenPages(query.data.pages).map((item) => ({
      id: item.id,
      name: item.name,
      edrpou: item.edrpou,
    }));
  }, [query.data]);

  return {
    status: enabled ? query.status : "idle",
    items,
    retry: () => {
      void query.refetch();
    },
  };
}
