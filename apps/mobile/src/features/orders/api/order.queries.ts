/**
 * `orders.list` read bindings (SHO-211 / SHO-351). Keys follow SHO-102:
 * `[actionName, companyId, input]`; the page cursor is the infinite
 * query page param, never part of the key.
 */
import type { ContractClient } from "../../../api/client";
import { contractInfiniteQueryOptions } from "../../../api/query-options";

export const LIST_ORDERS_ACTION = "orders.list";

type ShowzyClient = ContractClient;
export type ListOrdersOutput = Awaited<
  ReturnType<ShowzyClient["client"]["orders"]["list"]>
>;
export type ListOrdersSummaryPage = Extract<
  ListOrdersOutput,
  { kind: "page.summary" }
>;
export type OrderListItem = ListOrdersSummaryPage["items"][number];

export type OrderStatusFilter = "new" | "confirmed" | "canceled";

export type ListOrdersPageInput = {
  readonly kind: "page.summary";
  readonly filter?: {
    readonly statuses?: OrderStatusFilter[];
    readonly query?: string;
  };
};

async function fetchOrdersSummaryPage(
  client: ShowzyClient,
  input: ListOrdersPageInput,
  cursor: string | null,
): Promise<ListOrdersSummaryPage> {
  const page = await client.client.orders.list({
    ...input,
    ...(cursor === null ? {} : { cursor }),
  });
  if (page.kind !== "page.summary") {
    throw new TypeError("orders.list expected page.summary");
  }
  return page;
}

export function listOrdersInfiniteOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly input: ListOrdersPageInput;
  readonly getActiveCompany: () => string | null;
}) {
  const client = args.client;
  return {
    ...contractInfiniteQueryOptions({
      actionName: LIST_ORDERS_ACTION,
      companyId: args.companyId,
      input: args.input,
      getActiveCompany: args.getActiveCompany,
      queryFn: (cursor: string | null) => {
        if (client === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return fetchOrdersSummaryPage(client, args.input, cursor);
      },
      nextCursor: (page: ListOrdersSummaryPage) => page.nextCursor,
    }),
    enabled: client !== null && args.companyId !== null,
  };
}
