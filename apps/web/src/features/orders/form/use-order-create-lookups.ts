/**
 * Customer/product lookups for order create (SHO-379). First page only
 * (`limit` 50). Variants load `catalog.getProduct` when that level is open.
 */
import { useQuery } from "@tanstack/react-query";

import { useApiClient } from "../../../api/api-provider";
import { useActiveCompany } from "../../../api/query-provider";
import {
  catalogGetProductQueryOptions,
  catalogListProductsQueryOptions,
} from "../api/catalog";
import { customersListQueryOptions } from "../api/customers-list";

export function useOrderCreateLookups(args: {
  readonly enabled: boolean;
  readonly variantProductId: string | null;
}) {
  const client = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const customers = useQuery({
    ...customersListQueryOptions({
      client,
      companyId: activeCompanyId,
    }),
    enabled: args.enabled && activeCompanyId !== null,
  });
  const products = useQuery({
    ...catalogListProductsQueryOptions({
      client,
      companyId: activeCompanyId,
    }),
    enabled: args.enabled && activeCompanyId !== null,
  });
  const product = useQuery({
    ...catalogGetProductQueryOptions({
      client,
      companyId: activeCompanyId,
      productId: args.variantProductId,
    }),
    enabled: args.enabled && args.variantProductId !== null,
  });

  return {
    customers: customers.data?.items ?? [],
    customersStatus: customers.status,
    products: products.data?.items ?? [],
    productsStatus: products.status,
    variants: (product.data?.variants ?? []).filter(
      (variant) => variant.status === "active",
    ),
    variantsStatus: product.status,
  };
}
