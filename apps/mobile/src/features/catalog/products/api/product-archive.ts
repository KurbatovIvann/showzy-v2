/**
 * Status-only catalog writes (SHO-138 / catalog-T6). One binder so the
 * detail screen can mint a single `useContractMutation` attempt per
 * confirm. Cache invalidation is post-success only — never optimistic.
 */
import type { MutationCallOptions } from "@showzy/contract";
import type { QueryClient } from "@tanstack/react-query";

import { companyQueryScope } from "../../../../api/query-options";
import { GET_PRODUCT_ACTION } from "./product-detail-query";
import { LIST_PRODUCTS_ACTION } from "./products-list-query";

export type CatalogStatusWrite =
  | { readonly kind: "archiveProduct"; readonly productId: string }
  | { readonly kind: "restoreProduct"; readonly productId: string }
  | { readonly kind: "archiveVariant"; readonly variantId: string }
  | { readonly kind: "restoreVariant"; readonly variantId: string };

export type CatalogStatusTransport = {
  readonly client: {
    readonly catalog: {
      readonly archiveProduct: (
        input: { productId: string },
        options: MutationCallOptions,
      ) => Promise<{ productId: string; status: "archived" }>;
      readonly restoreProduct: (
        input: { productId: string },
        options: MutationCallOptions,
      ) => Promise<{ productId: string; status: "active" }>;
      readonly archiveVariant: (
        input: { variantId: string },
        options: MutationCallOptions,
      ) => Promise<{ variantId: string; status: "archived" }>;
      readonly restoreVariant: (
        input: { variantId: string },
        options: MutationCallOptions,
      ) => Promise<{ variantId: string; status: "active" }>;
    };
  };
};

export function bindCatalogStatusMutate(client: CatalogStatusTransport) {
  return (
    input: CatalogStatusWrite,
    options: MutationCallOptions,
  ): Promise<unknown> => {
    switch (input.kind) {
      case "archiveProduct":
        return client.client.catalog.archiveProduct(
          { productId: input.productId },
          options,
        );
      case "restoreProduct":
        return client.client.catalog.restoreProduct(
          { productId: input.productId },
          options,
        );
      case "archiveVariant":
        return client.client.catalog.archiveVariant(
          { variantId: input.variantId },
          options,
        );
      case "restoreVariant":
        return client.client.catalog.restoreVariant(
          { variantId: input.variantId },
          options,
        );
    }
  };
}

/**
 * Partial keys so every `catalog.getProduct` input and every
 * `catalog.listProducts` page for this tenant refetch after a status
 * write. Signed download URLs are left alone.
 */
export function catalogStatusInvalidationKeys(
  companyId: string,
): readonly [readonly [string, string], readonly [string, string]] {
  const scope = companyQueryScope(companyId);
  return [
    [GET_PRODUCT_ACTION, scope],
    [LIST_PRODUCTS_ACTION, scope],
  ] as const;
}

export async function invalidateCatalogAfterStatusWrite(args: {
  readonly queryClient: QueryClient;
  readonly companyId: string | null;
}): Promise<void> {
  if (args.companyId === null) {
    return;
  }
  await Promise.all(
    catalogStatusInvalidationKeys(args.companyId).map((queryKey) =>
      args.queryClient.invalidateQueries({ queryKey }),
    ),
  );
}
