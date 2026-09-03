/**
 * `customers.listCustomers` for the order create picker (SHO-379). Lives
 * in the orders slice so feature code does not import `features/customers`.
 * Picker search is the contract `search` field (query key includes it).
 */
import type { ShowzyClient } from "../../../api/client";
import {
  contractQueryKey,
  contractQueryOptions,
} from "../../../api/query-options";
import {
  LIST_CUSTOMERS_SEARCH_MAX,
  normalizeOrderLookupSearch,
  ORDER_LOOKUP_PAGE_SIZE,
} from "../shared/order-caps";

export const LIST_CUSTOMERS_ACTION = "customers.listCustomers";

export const ORDER_CUSTOMER_LOOKUP_INPUT = {
  status: "active" as const,
  limit: ORDER_LOOKUP_PAGE_SIZE,
};

export type OrderCustomerLookupInput = {
  readonly status: "active";
  readonly limit: number;
  readonly search?: string;
};

type ListCustomersClient = ShowzyClient;
export type ListCustomersOutput = Awaited<
  ReturnType<ListCustomersClient["client"]["customers"]["listCustomers"]>
>;
export type OrderCustomerOption = ListCustomersOutput["items"][number];

export function orderCustomerLookupInput(
  searchText: string | undefined,
): OrderCustomerLookupInput {
  const search = normalizeOrderLookupSearch(
    searchText ?? "",
    LIST_CUSTOMERS_SEARCH_MAX,
  );
  if (search === undefined) {
    return ORDER_CUSTOMER_LOOKUP_INPUT;
  }
  return { ...ORDER_CUSTOMER_LOOKUP_INPUT, search };
}

export function customersListQueryKey(companyId: string, searchText?: string) {
  return contractQueryKey(
    LIST_CUSTOMERS_ACTION,
    companyId,
    orderCustomerLookupInput(searchText),
  );
}

export function customersListQueryOptions(args: {
  readonly client: ShowzyClient;
  readonly companyId: string | null;
  readonly search?: string;
}) {
  const companyId = args.companyId;
  const input = orderCustomerLookupInput(args.search);
  return {
    ...contractQueryOptions({
      actionName: LIST_CUSTOMERS_ACTION,
      companyId,
      input,
      getActiveCompany: () => args.client.getActiveCompany(),
      queryFn: () => args.client.client.customers.listCustomers(input),
    }),
    enabled: companyId !== null,
  };
}
