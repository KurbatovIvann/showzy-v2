/**
 * `catalog.listProducts` with `status: "all"` for the price-list editor
 * (SHO-190). Archived rows are included; the editor shows an Архівний
 * pill. This is not a new catalog action.
 */
import type { ContractClient } from "../../../api/client";
import { contractQueryOptions } from "../../../api/query-options";
import { PRICE_LIST_EDITOR_PAGE_LIMIT } from "../shared/price-list-caps";
import { collectPagedItems } from "./collect-paged";

export const LIST_PRODUCTS_ACTION = "catalog.listProducts";
export const GET_PRODUCT_ACTION = "catalog.getProduct";

type ShowzyClient = ContractClient;
export type ListProductsOutput = Awaited<
  ReturnType<ShowzyClient["client"]["catalog"]["listProducts"]>
>;
export type CatalogProductListItem = ListProductsOutput["items"][number];
export type GetProductOutput = Awaited<
  ReturnType<ShowzyClient["client"]["catalog"]["getProduct"]>
>;

export type CatalogListTransport = {
  readonly client: {
    readonly catalog: {
      readonly listProducts: (input: {
        readonly status: "all";
        readonly limit?: number;
        readonly cursor?: string;
      }) => Promise<ListProductsOutput>;
    };
  };
};

export const PRICE_LIST_EDITOR_PRODUCTS_INPUT = {
  status: "all" as const,
  limit: PRICE_LIST_EDITOR_PAGE_LIMIT,
};

export async function listAllCatalogProducts(
  client: CatalogListTransport,
): Promise<CatalogProductListItem[]> {
  return collectPagedItems((cursor) =>
    client.client.catalog.listProducts({
      ...PRICE_LIST_EDITOR_PRODUCTS_INPUT,
      ...(cursor === null ? {} : { cursor }),
    }),
  );
}

export function listAllCatalogProductsQueryOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly enabled: boolean;
  readonly getActiveCompany: () => string | null;
}) {
  const client = args.client;
  return {
    ...contractQueryOptions({
      actionName: LIST_PRODUCTS_ACTION,
      companyId: args.companyId,
      input: { ...PRICE_LIST_EDITOR_PRODUCTS_INPUT, allPages: true as const },
      getActiveCompany: args.getActiveCompany,
      queryFn: () => {
        if (client === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return listAllCatalogProducts(client);
      },
    }),
    enabled: args.enabled && client !== null && args.companyId !== null,
  };
}

export function getCatalogProductQueryOptions(args: {
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
