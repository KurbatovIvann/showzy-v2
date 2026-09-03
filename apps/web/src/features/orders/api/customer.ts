/**
 * `customers.getCustomer` hydration for order detail (SHO-378). Lives in
 * the orders slice so feature code does not import `features/customers`.
 */
import type { ShowzyClient } from "../../../api/client";
import { contractQueryOptions } from "../../../api/query-options";

export const GET_CUSTOMER_ACTION = "customers.getCustomer";

type GetCustomerClient = ShowzyClient;
export type GetCustomerOutput = Awaited<
  ReturnType<GetCustomerClient["client"]["customers"]["getCustomer"]>
>;

export function customerGetQueryOptions(args: {
  readonly client: ShowzyClient;
  readonly companyId: string | null;
  readonly customerId: string | null;
}) {
  const customerId = args.customerId ?? "";
  return {
    ...contractQueryOptions({
      actionName: GET_CUSTOMER_ACTION,
      companyId: args.companyId,
      input: { id: customerId },
      getActiveCompany: () => args.client.getActiveCompany(),
      queryFn: () =>
        args.client.client.customers.getCustomer({ id: customerId }),
    }),
    enabled: args.companyId !== null && args.customerId !== null,
  };
}
