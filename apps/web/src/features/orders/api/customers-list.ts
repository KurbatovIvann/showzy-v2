/**
 * `customers.listCustomers` for the order create picker (SHO-379). Lives
 * in the orders slice so feature code does not import `features/customers`.
 */
import type { ShowzyClient } from "../../../api/client";
import {
  contractQueryKey,
  contractQueryOptions,
} from "../../../api/query-options";
import { ORDER_LOOKUP_PAGE_SIZE } from "../shared/order-caps";

export const LIST_CUSTOMERS_ACTION = "customers.listCustomers";

export const ORDER_CUSTOMER_LOOKUP_INPUT = {
  status: "active" as const,
  limit: ORDER_LOOKUP_PAGE_SIZE,
};

type ListCustomersClient = ShowzyClient;
export type ListCustomersOutput = Awaited<
  ReturnType<ListCustomersClient["client"]["customers"]["listCustomers"]>
>;
export type OrderCustomerOption = ListCustomersOutput["items"][number];

export function customersListQueryKey(companyId: string) {
  return contractQueryKey(
    LIST_CUSTOMERS_ACTION,
    companyId,
    ORDER_CUSTOMER_LOOKUP_INPUT,
  );
}

export function customersListQueryOptions(args: {
  readonly client: ShowzyClient;
  readonly companyId: string | null;
}) {
  const companyId = args.companyId;
  return {
    ...contractQueryOptions({
      actionName: LIST_CUSTOMERS_ACTION,
      companyId,
      input: ORDER_CUSTOMER_LOOKUP_INPUT,
      getActiveCompany: () => args.client.getActiveCompany(),
      queryFn: () =>
        args.client.client.customers.listCustomers(ORDER_CUSTOMER_LOOKUP_INPUT),
    }),
    enabled: companyId !== null,
  };
}
