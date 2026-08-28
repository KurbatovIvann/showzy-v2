/**
 * `pricing.getPriceList` read binding (SHO-190). Keys follow SHO-102.
 * Invalid route ids never call this — `priceListIdFromParam` refuses
 * non-UUIDs first.
 */
import type { ContractClient } from "../../../api/client";
import { contractQueryOptions } from "../../../api/query-options";
import { GET_PRICE_LIST_ACTION } from "./price-list-cache";

type ShowzyClient = ContractClient;
export type GetPriceListOutput = Awaited<
  ReturnType<ShowzyClient["client"]["pricing"]["getPriceList"]>
>;

export function getPriceListQueryOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly priceListId: string | null;
  readonly getActiveCompany: () => string | null;
}) {
  const client = args.client;
  const id = args.priceListId ?? "";
  return {
    ...contractQueryOptions({
      actionName: GET_PRICE_LIST_ACTION,
      companyId: args.companyId,
      input: { id },
      getActiveCompany: args.getActiveCompany,
      queryFn: () => {
        if (client === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return client.client.pricing.getPriceList({ id });
      },
    }),
    enabled:
      client !== null && args.companyId !== null && args.priceListId !== null,
  };
}
