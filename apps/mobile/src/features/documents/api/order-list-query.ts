/**
 * `orders.list` for the document create order picker (SHO-238). Keys
 * follow SHO-102: `[actionName, companyId, input]`. Lives in the
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
export type DocumentOrderListItem = ListOrdersOutput["items"][number];

export const DOCUMENT_ORDERS_LOOKUP_INPUT = {
  status: "confirmed" as const,
  limit: DOCUMENT_LOOKUP_PAGE_SIZE,
};

export type ListDocumentOrdersPageInput = typeof DOCUMENT_ORDERS_LOOKUP_INPUT;

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
        return client.client.orders.list({
          ...DOCUMENT_ORDERS_LOOKUP_INPUT,
          ...(cursor === null ? {} : { cursor }),
        });
      },
      nextCursor: (page: ListOrdersOutput) => page.nextCursor,
    }),
    enabled:
      (args.enabled ?? true) && client !== null && args.companyId !== null,
  };
}
