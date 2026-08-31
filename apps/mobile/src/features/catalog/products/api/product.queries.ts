/**
 * `catalog.listProducts` read bindings (SHO-137 / SHO-157). Keys follow
 * SHO-102: `[actionName, companyId, input]`; the page cursor is the
 * infinite query page param, never part of the key.
 */
import type { ContractClient } from "../../../../api/client";
import { requireReadyClient } from "../../../../api/errors";
import {
  contractInfiniteQueryOptions,
  contractQueryOptions,
} from "../../../../api/query-options";

export const LIST_PRODUCTS_ACTION = "catalog.listProducts";

type ShowzyClient = ContractClient;
export type ListProductsOutput = Awaited<
  ReturnType<ShowzyClient["client"]["catalog"]["listProducts"]>
>;
export type ProductListItem = ListProductsOutput["items"][number];

export type ProductsStatusFilter = "active" | "archived" | "all";

export type ListProductsPageInput = {
  readonly status: ProductsStatusFilter;
  readonly query?: string;
};

export function listProductsInfiniteOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly input: ListProductsPageInput;
  readonly getActiveCompany: () => string | null;
}) {
  const client = args.client;
  return {
    ...contractInfiniteQueryOptions({
      actionName: LIST_PRODUCTS_ACTION,
      companyId: args.companyId,
      input: args.input,
      getActiveCompany: args.getActiveCompany,
      queryFn: (cursor: string | null) =>
        requireReadyClient(client).client.catalog.listProducts({
          ...args.input,
          ...(cursor === null ? {} : { cursor }),
        }),
      nextCursor: (page: ListProductsOutput) => page.nextCursor,
    }),
    enabled: client !== null && args.companyId !== null,
  };
}

/**
 * One-row `status: "all"` probe: distinguishes an empty catalog from
 * "no active products" when the active filter comes back empty (the
 * canvas shows different empty states for the two).
 */
export const PRODUCTS_PROBE_INPUT = {
  status: "all",
  limit: 1,
} as const;

export function productsProbeQueryOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly getActiveCompany: () => string | null;
}) {
  const client = args.client;
  return contractQueryOptions({
    actionName: LIST_PRODUCTS_ACTION,
    companyId: args.companyId,
    input: PRODUCTS_PROBE_INPUT,
    getActiveCompany: args.getActiveCompany,
    queryFn: () =>
      requireReadyClient(client).client.catalog.listProducts(
        PRODUCTS_PROBE_INPUT,
      ),
  });
}
