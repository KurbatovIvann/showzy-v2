import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useActiveCompany } from "../../../api/query-provider";
import {
  getOrderCatalogProductQueryOptions,
  listOrderProductsInfiniteOptions,
} from "../api/order-catalog-query";
import { listOrderCustomersInfiniteOptions } from "../api/order-customers-query";
import { flattenPages, optionSelectItems } from "./option-select";
import { useDrainInfinitePages } from "./use-drain-pages";

export function useOrderFormLookups(args: {
  readonly enabled: boolean;
  readonly variantProductId: string | null;
}): {
  readonly customerOptions: ReturnType<typeof optionSelectItems>;
  readonly productRows: readonly {
    readonly id: string;
    readonly name: string;
    readonly variantCount: number;
  }[];
  readonly variantOptions: ReturnType<typeof optionSelectItems>;
  readonly variantsReady: boolean;
} {
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;
  const enabled = args.enabled;

  const customersQuery = useInfiniteQuery(
    listOrderCustomersInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      getActiveCompany,
      enabled,
    }),
  );
  useDrainInfinitePages({
    status: customersQuery.status,
    hasNextPage: customersQuery.hasNextPage,
    isFetchingNextPage: customersQuery.isFetchingNextPage,
    fetchNextPage: customersQuery.fetchNextPage,
  });

  const productsQuery = useInfiniteQuery(
    listOrderProductsInfiniteOptions({
      client: apiClient,
      companyId: activeCompanyId,
      getActiveCompany,
      enabled,
    }),
  );
  useDrainInfinitePages({
    status: productsQuery.status,
    hasNextPage: productsQuery.hasNextPage,
    isFetchingNextPage: productsQuery.isFetchingNextPage,
    fetchNextPage: productsQuery.fetchNextPage,
  });

  const productQuery = useQuery(
    getOrderCatalogProductQueryOptions({
      client: apiClient,
      companyId: activeCompanyId,
      productId: args.variantProductId,
      getActiveCompany,
    }),
  );

  const customerOptions = useMemo(() => {
    if (customersQuery.data === undefined) {
      return [];
    }
    const rows = flattenPages(customersQuery.data.pages);
    return optionSelectItems(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.phone,
      })),
    );
  }, [customersQuery.data]);

  const productRows = useMemo(() => {
    if (productsQuery.data === undefined) {
      return [];
    }
    return flattenPages(productsQuery.data.pages).map((row) => ({
      id: row.id,
      name: row.name,
      variantCount: row.variantCount,
    }));
  }, [productsQuery.data]);

  const variantOptions = useMemo(() => {
    if (productQuery.data === undefined) {
      return [];
    }
    return optionSelectItems(
      productQuery.data.variants
        .filter((variant) => variant.status === "active")
        .map((variant) => ({
          id: variant.id,
          name: variant.name,
        })),
    );
  }, [productQuery.data]);

  return {
    customerOptions,
    productRows,
    variantOptions,
    variantsReady:
      args.variantProductId === null || productQuery.status === "success",
  };
}
