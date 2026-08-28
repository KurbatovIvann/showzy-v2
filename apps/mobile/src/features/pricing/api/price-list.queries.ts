/**
 * `pricing.listPriceLists` read bindings for the More → Прайс-листи
 * screen (SHO-189). Keys follow SHO-102. The customers picker binder in
 * `features/customers/api/price-list.queries.ts` stays `{ limit }`-only.
 */
import type { ContractClient } from "../../../api/client";
import { contractInfiniteQueryOptions } from "../../../api/query-options";

export const LIST_PRICE_LISTS_ACTION = "pricing.listPriceLists";

type ShowzyClient = ContractClient;
export type ListPriceListsOutput = Awaited<
  ReturnType<ShowzyClient["client"]["pricing"]["listPriceLists"]>
>;
export type PriceListItem = ListPriceListsOutput["items"][number];

export type PriceListsAvailability = "all" | "active" | "inactive";

export type ListPriceListsPageInput = {
  readonly availability: PriceListsAvailability;
  readonly query?: string;
};

export type PriceListListTransport = {
  readonly client: {
    readonly pricing: {
      readonly listPriceLists: (
        input: ListPriceListsPageInput & { readonly cursor?: string },
      ) => Promise<ListPriceListsOutput>;
    };
  };
};

export function listPriceListsWireInput(
  input: ListPriceListsPageInput,
  cursor: string | null,
): ListPriceListsPageInput & { readonly cursor?: string } {
  return {
    ...input,
    ...(cursor === null ? {} : { cursor }),
  };
}

export function bindListPriceListsPage(
  client: PriceListListTransport,
  input: ListPriceListsPageInput,
) {
  return (cursor: string | null): Promise<ListPriceListsOutput> => {
    return client.client.pricing.listPriceLists(
      listPriceListsWireInput(input, cursor),
    );
  };
}

export function listPriceListsInfiniteOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly input: ListPriceListsPageInput;
  readonly getActiveCompany: () => string | null;
}) {
  const client = args.client;
  return {
    ...contractInfiniteQueryOptions({
      actionName: LIST_PRICE_LISTS_ACTION,
      companyId: args.companyId,
      input: args.input,
      getActiveCompany: args.getActiveCompany,
      queryFn: (cursor: string | null) => {
        if (client === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return bindListPriceListsPage(client, args.input)(cursor);
      },
      nextCursor: (page: ListPriceListsOutput) => page.nextCursor,
    }),
    enabled: client !== null && args.companyId !== null,
  };
}
