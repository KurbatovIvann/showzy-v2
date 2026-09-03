/**
 * Company-scoped `orders.list`. The **key** uses `companyId` from
 * React state (`useActiveCompany().activeCompanyId`). The **assert**
 * binds `() => client.getActiveCompany()` so a render-closed id cannot
 * skip isolation while `x-company-id` already moved. Loaders and hooks
 * must share this factory.
 */
import type { ShowzyClient } from "../../../api/client";
import {
  contractQueryKey,
  contractQueryOptions,
} from "../../../api/query-options";
import type { ListOrdersPageInput } from "./orders-list-search";

export const LIST_ORDERS_ACTION = "orders.list";

type ListOrdersClient = ShowzyClient;
export type ListOrdersOutput = Awaited<
  ReturnType<ListOrdersClient["client"]["orders"]["list"]>
>;
export type ListOrdersSummaryPage = Extract<
  ListOrdersOutput,
  { kind: "page.summary" }
>;
export type OrderListItem = ListOrdersSummaryPage["items"][number];

async function fetchOrdersSummaryPage(
  client: ShowzyClient,
  input: ListOrdersPageInput,
): Promise<ListOrdersSummaryPage> {
  const page = await client.client.orders.list(input);
  if (page.kind !== "page.summary") {
    throw new TypeError("orders.list expected page.summary");
  }
  return page;
}

export function ordersListQueryKey(
  companyId: string,
  input: ListOrdersPageInput,
) {
  return contractQueryKey(LIST_ORDERS_ACTION, companyId, input);
}

export function ordersListQueryOptions(args: {
  readonly client: ShowzyClient;
  readonly companyId: string | null;
  readonly input: ListOrdersPageInput;
}) {
  const companyId = args.companyId;
  return {
    ...contractQueryOptions({
      actionName: LIST_ORDERS_ACTION,
      companyId,
      input: args.input,
      getActiveCompany: () => args.client.getActiveCompany(),
      queryFn: () => fetchOrdersSummaryPage(args.client, args.input),
    }),
    enabled: companyId !== null,
  };
}
