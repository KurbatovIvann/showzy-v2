/**
 * `customers.getCustomer` hydration for the orders list and detail
 * (SHO-211 / SHO-212). Keys follow SHO-102: `[actionName, companyId,
 * input]`. This binder lives in the orders slice so feature code does
 * not import `features/customers`.
 */
import type { ContractClient } from "../../../api/client";
import { contractQueryOptions } from "../../../api/query-options";

export const GET_CUSTOMER_ACTION = "customers.getCustomer";

type ShowzyClient = ContractClient;
export type GetCustomerOutput = Awaited<
  ReturnType<ShowzyClient["client"]["customers"]["getCustomer"]>
>;

export function getCustomerNameQueryOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly customerId: string | null;
  readonly getActiveCompany: () => string | null;
}) {
  const client = args.client;
  const customerId = args.customerId ?? "";
  return {
    ...contractQueryOptions({
      actionName: GET_CUSTOMER_ACTION,
      companyId: args.companyId,
      input: { id: customerId },
      getActiveCompany: args.getActiveCompany,
      queryFn: () => {
        if (client === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return client.client.customers.getCustomer({ id: customerId });
      },
    }),
    enabled:
      client !== null && args.companyId !== null && args.customerId !== null,
  };
}
