import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useActiveCompany } from "../../../api/query-provider";
import {
  flattenPages,
  optionSelectItems,
  type OptionSelectItem,
} from "../../../components/ui";
import { useDrainInfinitePages } from "../../../hooks/use-drain-pages";
import { listDocumentCounterpartiesInfiniteOptions } from "../api/counterparty-list-query";
import { listDocumentOrdersInfiniteOptions } from "../api/order-list-query";
import {
  documentCounterpartyOptionDescription,
  documentOrderOptionDescription,
  documentOrderOptionName,
} from "./document-form-pickers";

export type DocumentFormOrderRow = {
  readonly id: string;
  readonly customerId: string | null;
  readonly name: string;
  readonly description: string;
};

export function useDocumentFormLookups(args: {
  readonly enabled: boolean;
  readonly orderId: string;
}): {
  readonly orderOptions: readonly OptionSelectItem[];
  readonly orderRows: readonly DocumentFormOrderRow[];
  readonly counterpartyOptions: readonly OptionSelectItem[];
  readonly selectedOrder: DocumentFormOrderRow | null;
} {
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;
  const enabled = args.enabled;

  const ordersQuery = useInfiniteQuery(
    listDocumentOrdersInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      getActiveCompany,
      enabled,
    }),
  );
  useDrainInfinitePages({
    status: ordersQuery.status,
    hasNextPage: ordersQuery.hasNextPage,
    isFetchingNextPage: ordersQuery.isFetchingNextPage,
    fetchNextPage: ordersQuery.fetchNextPage,
  });

  const orderRows = useMemo((): readonly DocumentFormOrderRow[] => {
    if (ordersQuery.data === undefined) {
      return [];
    }
    return flattenPages(ordersQuery.data.pages).map((row) => ({
      id: row.orderId,
      customerId: row.customer.linkedCustomerId,
      name: documentOrderOptionName(row),
      description: documentOrderOptionDescription(row),
    }));
  }, [ordersQuery.data]);

  const selectedOrder =
    orderRows.find((row) => row.id === args.orderId) ?? null;
  const customerId = selectedOrder?.customerId ?? null;

  const counterpartiesQuery = useInfiniteQuery(
    listDocumentCounterpartiesInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      customerId,
      getActiveCompany,
      enabled: enabled && customerId !== null,
    }),
  );
  useDrainInfinitePages({
    status: counterpartiesQuery.status,
    hasNextPage: counterpartiesQuery.hasNextPage,
    isFetchingNextPage: counterpartiesQuery.isFetchingNextPage,
    fetchNextPage: counterpartiesQuery.fetchNextPage,
  });

  const orderOptions = useMemo(
    () =>
      optionSelectItems(
        orderRows.map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description,
        })),
      ),
    [orderRows],
  );

  const counterpartyOptions = useMemo(() => {
    if (counterpartiesQuery.data === undefined) {
      return [];
    }
    return optionSelectItems(
      flattenPages(counterpartiesQuery.data.pages).map((row) => ({
        id: row.id,
        name: row.name,
        description: documentCounterpartyOptionDescription(row),
      })),
    );
  }, [counterpartiesQuery.data]);

  return {
    orderOptions,
    orderRows,
    counterpartyOptions,
    selectedOrder,
  };
}
