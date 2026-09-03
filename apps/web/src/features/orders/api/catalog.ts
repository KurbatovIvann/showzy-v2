/**
 * `catalog.listProducts` / `catalog.getProduct` for the order create
 * picker (SHO-379). Binders live in the orders slice. The view must not
 * render catalog `basePriceMinor` — totals come from snapshots after
 * `orders.create`. Picker search is the contract `query` field (query
 * key includes it).
 */
import type { ShowzyClient } from "../../../api/client";
import {
  contractQueryKey,
  contractQueryOptions,
} from "../../../api/query-options";
import {
  LIST_PRODUCTS_QUERY_MAX,
  normalizeOrderLookupSearch,
  ORDER_LOOKUP_PAGE_SIZE,
} from "../shared/order-caps";

export const LIST_PRODUCTS_ACTION = "catalog.listProducts";
export const GET_PRODUCT_ACTION = "catalog.getProduct";

export const ORDER_PRODUCT_LOOKUP_INPUT = {
  status: "active" as const,
  limit: ORDER_LOOKUP_PAGE_SIZE,
};

export type OrderProductLookupInput = {
  readonly status: "active";
  readonly limit: number;
  readonly query?: string;
};

type CatalogClient = ShowzyClient;
export type ListProductsOutput = Awaited<
  ReturnType<CatalogClient["client"]["catalog"]["listProducts"]>
>;
export type GetProductOutput = Awaited<
  ReturnType<CatalogClient["client"]["catalog"]["getProduct"]>
>;
export type OrderProductOption = ListProductsOutput["items"][number];
export type OrderProductVariant = GetProductOutput["variants"][number];

export function orderProductLookupInput(
  queryText: string | undefined,
): OrderProductLookupInput {
  const query = normalizeOrderLookupSearch(
    queryText ?? "",
    LIST_PRODUCTS_QUERY_MAX,
  );
  if (query === undefined) {
    return ORDER_PRODUCT_LOOKUP_INPUT;
  }
  return { ...ORDER_PRODUCT_LOOKUP_INPUT, query };
}

export function catalogListProductsQueryKey(
  companyId: string,
  queryText?: string,
) {
  return contractQueryKey(
    LIST_PRODUCTS_ACTION,
    companyId,
    orderProductLookupInput(queryText),
  );
}

export function catalogGetProductQueryKey(
  companyId: string,
  productId: string,
) {
  return contractQueryKey(GET_PRODUCT_ACTION, companyId, { productId });
}

export function catalogListProductsQueryOptions(args: {
  readonly client: ShowzyClient;
  readonly companyId: string | null;
  readonly query?: string;
}) {
  const companyId = args.companyId;
  const input = orderProductLookupInput(args.query);
  return {
    ...contractQueryOptions({
      actionName: LIST_PRODUCTS_ACTION,
      companyId,
      input,
      getActiveCompany: () => args.client.getActiveCompany(),
      queryFn: () => args.client.client.catalog.listProducts(input),
    }),
    enabled: companyId !== null,
  };
}

export function catalogGetProductQueryOptions(args: {
  readonly client: ShowzyClient;
  readonly companyId: string | null;
  readonly productId: string | null;
}) {
  const companyId = args.companyId;
  const productId = args.productId ?? "";
  return {
    ...contractQueryOptions({
      actionName: GET_PRODUCT_ACTION,
      companyId,
      input: { productId },
      getActiveCompany: () => args.client.getActiveCompany(),
      queryFn: () => args.client.client.catalog.getProduct({ productId }),
    }),
    enabled: companyId !== null && args.productId !== null,
  };
}
