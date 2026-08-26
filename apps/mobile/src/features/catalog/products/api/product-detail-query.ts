/**
 * `catalog.getProduct` read binding (SHO-138). Keys follow SHO-102:
 * `[actionName, companyId, input]`.
 */
import type { ContractClient } from "../../../../api/client";
import { contractQueryOptions } from "../../../../api/query-options";

export const GET_PRODUCT_ACTION = "catalog.getProduct";

type ShowzyClient = ContractClient;
export type GetProductOutput = Awaited<
  ReturnType<ShowzyClient["client"]["catalog"]["getProduct"]>
>;
export type GetProductVariant = GetProductOutput["variants"][number];

export function getProductQueryOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly productId: string | null;
  readonly getActiveCompany: () => string | null;
}) {
  const client = args.client;
  const productId = args.productId ?? "";
  return {
    ...contractQueryOptions({
      actionName: GET_PRODUCT_ACTION,
      companyId: args.companyId,
      input: { productId },
      getActiveCompany: args.getActiveCompany,
      queryFn: () => {
        if (client === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return client.client.catalog.getProduct({ productId });
      },
    }),
    enabled:
      client !== null && args.companyId !== null && args.productId !== null,
  };
}
