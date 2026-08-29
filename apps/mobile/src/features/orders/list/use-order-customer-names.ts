/**
 * Per-id `customers.getCustomer` hydration for list rows (SHO-211).
 * Deleted or unreadable CRM falls through to presenter fallback copy.
 */
import { useQueries } from "@tanstack/react-query";

import type { ContractClient } from "../../../api/client";
import { getCustomerNameQueryOptions } from "../api/customer-name-query";

export function uniqueCustomerIds(
  items: ReadonlyArray<{ readonly customerId: string | null }>,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const customerId = item.customerId;
    if (customerId === null || seen.has(customerId)) {
      continue;
    }
    seen.add(customerId);
    ids.push(customerId);
  }
  return ids;
}

export function customerNamesById(
  ids: readonly string[],
  names: ReadonlyArray<string | undefined>,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    const name = names[index]?.trim();
    if (id === undefined || name === undefined || name.length === 0) {
      continue;
    }
    map.set(id, name);
  }
  return map;
}

export function useOrderCustomerNames(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly getActiveCompany: () => string | null;
  readonly items: ReadonlyArray<{ readonly customerId: string | null }>;
}): {
  readonly namesByCustomerId: ReadonlyMap<string, string>;
  readonly refetch: () => void;
} {
  const customerIds = uniqueCustomerIds(args.items);
  const queries = useQueries({
    queries: customerIds.map((customerId) =>
      getCustomerNameQueryOptions({
        client: args.client,
        companyId: args.companyId,
        customerId,
        getActiveCompany: args.getActiveCompany,
      }),
    ),
  });
  const namesByCustomerId = customerNamesById(
    customerIds,
    queries.map((query) => query.data?.name),
  );

  return {
    namesByCustomerId,
    refetch: () => {
      for (const query of queries) {
        void query.refetch();
      }
    },
  };
}
