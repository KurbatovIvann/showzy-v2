/**
 * `pricing.listPriceListEntries` — load every page for the editor
 * (SHO-190). Cursor pages of 50; the query key is the list id.
 */
import type { ContractClient } from "../../../api/client";
import { contractQueryOptions } from "../../../api/query-options";
import { PRICE_LIST_EDITOR_PAGE_LIMIT } from "../shared/price-list-caps";
import { collectPagedItems } from "./collect-paged";
import { LIST_PRICE_LIST_ENTRIES_ACTION } from "./price-list-cache";

type ShowzyClient = ContractClient;
export type ListPriceListEntriesOutput = Awaited<
  ReturnType<ShowzyClient["client"]["pricing"]["listPriceListEntries"]>
>;
export type PriceListEntryItem = ListPriceListEntriesOutput["items"][number];

export type PriceListEntriesTransport = {
  readonly client: {
    readonly pricing: {
      readonly listPriceListEntries: (input: {
        readonly priceListId: string;
        readonly limit?: number;
        readonly cursor?: string;
      }) => Promise<ListPriceListEntriesOutput>;
    };
  };
};

export async function listAllPriceListEntries(
  client: PriceListEntriesTransport,
  priceListId: string,
): Promise<PriceListEntryItem[]> {
  return collectPagedItems((cursor) =>
    client.client.pricing.listPriceListEntries({
      priceListId,
      limit: PRICE_LIST_EDITOR_PAGE_LIMIT,
      ...(cursor === null ? {} : { cursor }),
    }),
  );
}

export function listAllPriceListEntriesQueryOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly priceListId: string | null;
  readonly getActiveCompany: () => string | null;
}) {
  const client = args.client;
  const priceListId = args.priceListId ?? "";
  return {
    ...contractQueryOptions({
      actionName: LIST_PRICE_LIST_ENTRIES_ACTION,
      companyId: args.companyId,
      input: { priceListId, all: true as const },
      getActiveCompany: args.getActiveCompany,
      queryFn: () => {
        if (client === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return listAllPriceListEntries(client, priceListId);
      },
    }),
    enabled:
      client !== null && args.companyId !== null && args.priceListId !== null,
  };
}
