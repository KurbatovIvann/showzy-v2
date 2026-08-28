/**
 * `pricing.listPriceLists` read bindings for card meta (SHO-179).
 * Keys follow SHO-102. The picker CRUD stays on SHO-180 / SHO-181.
 */
import type { ContractClient } from "../../../api/client";
import { contractInfiniteQueryOptions } from "../../../api/query-options";

export const LIST_PRICE_LISTS_ACTION = "pricing.listPriceLists";

type ShowzyClient = ContractClient;
export type ListPriceListsOutput = Awaited<
  ReturnType<ShowzyClient["client"]["pricing"]["listPriceLists"]>
>;
export type PriceListItem = ListPriceListsOutput["items"][number];

export type ListPriceListsPageInput = {
  readonly limit?: number;
};

export function listPriceListsInfiniteOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly getActiveCompany: () => string | null;
  readonly input?: ListPriceListsPageInput;
  readonly enabled?: boolean;
}) {
  const client = args.client;
  const input = args.input ?? {};
  return {
    ...contractInfiniteQueryOptions({
      actionName: LIST_PRICE_LISTS_ACTION,
      companyId: args.companyId,
      input,
      getActiveCompany: args.getActiveCompany,
      queryFn: (cursor: string | null) => {
        if (client === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return client.client.pricing.listPriceLists({
          ...input,
          ...(cursor === null ? {} : { cursor }),
        });
      },
      nextCursor: (page: ListPriceListsOutput) => page.nextCursor,
    }),
    enabled:
      (args.enabled ?? true) && client !== null && args.companyId !== null,
  };
}
