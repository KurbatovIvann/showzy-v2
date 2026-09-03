/**
 * Order and counterparty lookups for the document create form
 * (SHO-238). Binders live in documents `api/` so the form does not
 * import the orders or customers feature folders.
 */
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
  firstCounterpartyNameByCustomerId,
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
  readonly missingCustomer: string;
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
  const { missingCustomer, orderId } = args;

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

  const counterpartiesQuery = useInfiniteQuery(
    listDocumentCounterpartiesInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      customerId: null,
      getActiveCompany,
      enabled,
    }),
  );
  useDrainInfinitePages({
    status: counterpartiesQuery.status,
    hasNextPage: counterpartiesQuery.hasNextPage,
    isFetchingNextPage: counterpartiesQuery.isFetchingNextPage,
    fetchNextPage: counterpartiesQuery.fetchNextPage,
  });

  const counterpartyNameByCustomerId = useMemo(() => {
    if (counterpartiesQuery.data === undefined) {
      return new Map<string, string>();
    }
    return firstCounterpartyNameByCustomerId(
      flattenPages(counterpartiesQuery.data.pages),
    );
  }, [counterpartiesQuery.data]);

  const orderRows = useMemo((): readonly DocumentFormOrderRow[] => {
    if (ordersQuery.data === undefined) {
      return [];
    }
    return flattenPages(ordersQuery.data.pages).map((row) => {
      const customerId = row.customer.linkedCustomerId;
      const counterpartyName =
        customerId === null
          ? null
          : (counterpartyNameByCustomerId.get(customerId) ?? null);
      return {
        id: row.orderId,
        customerId,
        name: documentOrderOptionName(row, missingCustomer),
        description: documentOrderOptionDescription(row, counterpartyName),
      };
    });
  }, [ordersQuery.data, counterpartyNameByCustomerId, missingCustomer]);

  const selectedOrder = orderRows.find((row) => row.id === orderId) ?? null;
  const customerId = selectedOrder?.customerId ?? null;

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
    if (counterpartiesQuery.data === undefined || customerId === null) {
      return [];
    }
    return optionSelectItems(
      flattenPages(counterpartiesQuery.data.pages)
        .filter((row) => row.customerId === customerId)
        .map((row) => ({
          id: row.id,
          name: row.name,
          description: documentCounterpartyOptionDescription(row),
        })),
    );
  }, [counterpartiesQuery.data, customerId]);

  return {
    orderOptions,
    orderRows,
    counterpartyOptions,
    selectedOrder,
  };
}
