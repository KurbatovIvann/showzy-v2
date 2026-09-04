/**
 * Customer/product lookups for order create (SHO-379). Debounced
 * picker query is `customers.listCustomers.search` /
 * `catalog.listProducts.query` (key includes that input). Client
 * `includes` is a last-resort filter on the returned page. Variants
 * load `catalog.getProduct` when that level is open.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useActiveCompany } from "../../../api/query-provider";
import {
  catalogGetProductQueryOptions,
  catalogListProductsQueryKey,
  catalogListProductsQueryOptions,
} from "../api/catalog";
import {
  customersListQueryKey,
  customersListQueryOptions,
} from "../api/customers-list";
import {
  LIST_CUSTOMERS_SEARCH_MAX,
  LIST_PRODUCTS_QUERY_MAX,
  normalizeOrderLookupSearch,
  ORDER_LOOKUP_SEARCH_DEBOUNCE_MS,
} from "../shared/order-caps";
import {
  orderThumbnailView,
  type OrderThumbnailView,
} from "../shared/order-thumbnails";
import { useOrderThumbnails } from "../shared/use-order-thumbnails";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [delayMs, value]);
  return debounced;
}

function matchesLookupQuery(haystack: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }
  return haystack.toLowerCase().includes(needle);
}

export function useOrderCreateLookups(args: {
  readonly enabled: boolean;
  readonly variantProductId: string | null;
  readonly customerQuery: string;
  readonly productQuery: string;
  readonly canFetchThumbnails: boolean;
}) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { activeCompanyId } = useActiveCompany();
  const debouncedCustomerQuery = useDebouncedValue(
    args.customerQuery,
    ORDER_LOOKUP_SEARCH_DEBOUNCE_MS,
  );
  const debouncedProductQuery = useDebouncedValue(
    args.productQuery,
    ORDER_LOOKUP_SEARCH_DEBOUNCE_MS,
  );
  const customerSearch = normalizeOrderLookupSearch(
    debouncedCustomerQuery,
    LIST_CUSTOMERS_SEARCH_MAX,
  );
  const productSearch = normalizeOrderLookupSearch(
    debouncedProductQuery,
    LIST_PRODUCTS_QUERY_MAX,
  );
  const customers = useQuery({
    ...customersListQueryOptions({
      client,
      companyId: activeCompanyId,
      ...(customerSearch === undefined ? {} : { search: customerSearch }),
    }),
    enabled: args.enabled && activeCompanyId !== null,
  });
  const products = useQuery({
    ...catalogListProductsQueryOptions({
      client,
      companyId: activeCompanyId,
      ...(productSearch === undefined ? {} : { query: productSearch }),
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

  const customerRows = useMemo(() => {
    const items = customers.data?.items ?? [];
    if (customerSearch === undefined) {
      return items;
    }
    return items.filter((row) =>
      matchesLookupQuery(`${row.name} ${row.phone ?? ""}`, customerSearch),
    );
  }, [customerSearch, customers.data?.items]);

  const productRows = useMemo(() => {
    const items = products.data?.items ?? [];
    if (productSearch === undefined) {
      return items;
    }
    return items.filter((row) => matchesLookupQuery(row.name, productSearch));
  }, [productSearch, products.data?.items]);

  const thumbnailPages = useMemo(
    () => [{ items: productRows }],
    [productRows],
  );
  const { urlsByFileId, failedFileIds } = useOrderThumbnails({
    client,
    companyId: activeCompanyId,
    getActiveCompany: () => client.getActiveCompany(),
    pages: thumbnailPages,
    enabled: args.enabled && args.canFetchThumbnails,
  });

  const thumbnailsByProductId = useMemo(() => {
    const map = new Map<string, OrderThumbnailView>();
    for (const row of productRows) {
      const fileId = args.canFetchThumbnails ? row.primaryImageFileId : null;
      map.set(
        row.id,
        orderThumbnailView({
          fileId,
          url: fileId === null ? undefined : urlsByFileId.get(fileId),
          downloadFailed: fileId !== null && failedFileIds.has(fileId),
        }),
      );
    }
    return map;
  }, [
    args.canFetchThumbnails,
    failedFileIds,
    productRows,
    urlsByFileId,
  ]);

  function retryCustomers(): void {
    if (activeCompanyId === null) {
      return;
    }
    void queryClient.invalidateQueries({
      queryKey: customersListQueryKey(activeCompanyId, customerSearch),
    });
  }

  function retryProducts(): void {
    if (activeCompanyId === null) {
      return;
    }
    void queryClient.invalidateQueries({
      queryKey: catalogListProductsQueryKey(activeCompanyId, productSearch),
    });
  }

  return {
    customers: customerRows,
    customersStatus: customers.status,
    customersError: customers.status === "error" ? customers.error : null,
    retryCustomers,
    products: productRows,
    productsStatus: products.status,
    productsError: products.status === "error" ? products.error : null,
    retryProducts,
    variants: (product.data?.variants ?? []).filter(
      (variant) => variant.status === "active",
    ),
    variantsStatus: product.status,
    thumbnailsByProductId,
  };
}
