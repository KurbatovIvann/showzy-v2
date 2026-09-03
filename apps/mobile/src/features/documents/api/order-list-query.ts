/**
 * `orders.list` for the document create order picker (SHO-238 / SHO-351).
 * Keys follow SHO-102: `[actionName, companyId, input]`. Lives in the
 * documents slice so form code does not import `features/orders`.
 * Confirmed only: canceled orders are ConflictError on create, and the
 * feature card does not ask for draft (`new`) create-from-order.
 */
import type { ContractClient } from "../../../api/client";
import { contractInfiniteQueryOptions } from "../../../api/query-options";
import { DOCUMENT_LOOKUP_PAGE_SIZE } from "../shared/document-caps";

export const LIST_ORDERS_ACTION = "orders.list";

type ShowzyClient = ContractClient;
export type ListOrdersOutput = Awaited<
  ReturnType<ShowzyClient["client"]["orders"]["list"]>
>;
export type ListOrdersSummaryPage = Extract<
  ListOrdersOutput,
  { kind: "page.summary" }
>;
export type DocumentOrderListItem = ListOrdersSummaryPage["items"][number];

export const DOCUMENT_ORDERS_LOOKUP_INPUT: {
  readonly kind: "page.summary";
  readonly filter: {
    readonly statuses: Array<
      "new" | "confirmed" | "in_progress" | "done" | "canceled"
    >;
  };
  readonly limit: number;
} = {
  kind: "page.summary",
  filter: { statuses: ["confirmed"] },
  limit: DOCUMENT_LOOKUP_PAGE_SIZE,
};

export type ListDocumentOrdersPageInput = typeof DOCUMENT_ORDERS_LOOKUP_INPUT;

async function fetchDocumentOrdersPage(
  client: ShowzyClient,
  cursor: string | null,
): Promise<ListOrdersSummaryPage> {
  const page = await client.client.orders.list({
    ...DOCUMENT_ORDERS_LOOKUP_INPUT,
    ...(cursor === null ? {} : { cursor }),
  });
  if (page.kind !== "page.summary") {
    throw new TypeError("orders.list expected page.summary");
  }
  return page;
}

export function listDocumentOrdersInfiniteOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly getActiveCompany: () => string | null;
  readonly enabled?: boolean;
}) {
  const client = args.client;
  return {
    ...contractInfiniteQueryOptions({
      actionName: LIST_ORDERS_ACTION,
      companyId: args.companyId,
      input: DOCUMENT_ORDERS_LOOKUP_INPUT,
      getActiveCompany: args.getActiveCompany,
      queryFn: (cursor: string | null) => {
        if (client === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return fetchDocumentOrdersPage(client, cursor);
      },
      nextCursor: (page: ListOrdersSummaryPage) => page.nextCursor,
    }),
    enabled:
      (args.enabled ?? true) && client !== null && args.companyId !== null,
  };
}
