/**
 * `orders.get` read binding (SHO-212). Keys follow SHO-102:
 * `[actionName, companyId, input]`.
 */
import type { ContractClient } from "../../../api/client";
import { contractQueryOptions } from "../../../api/query-options";

export const GET_ORDER_ACTION = "orders.get";

type ShowzyClient = ContractClient;
export type GetOrderOutput = Awaited<
  ReturnType<ShowzyClient["client"]["orders"]["get"]>
>;
export type GetOrderItem = GetOrderOutput["items"][number];

export function getOrderQueryOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly orderId: string | null;
  readonly getActiveCompany: () => string | null;
}) {
  const client = args.client;
  const orderId = args.orderId ?? "";
  return {
    ...contractQueryOptions({
      actionName: GET_ORDER_ACTION,
      companyId: args.companyId,
      input: { orderId },
      getActiveCompany: args.getActiveCompany,
      queryFn: () => {
        if (client === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return client.client.orders.get({ orderId });
      },
    }),
    enabled:
      client !== null && args.companyId !== null && args.orderId !== null,
  };
}
