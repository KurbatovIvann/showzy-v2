/**
 * Per-id `customers.getCustomer` hydration for list rows (SHO-211).
 * Pending and non-NOT_FOUND failures stay pending; only a settled
 * missing CRM becomes the deleted-customer fallback.
 */
import { useQueries } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";

import type { ContractClient } from "../../../api/client";
import { describeWireError } from "../../../api/errors";
import { getCustomerNameQueryOptions } from "../api/customer-name-query";
import {
  resolveCustomerNameHydration,
  type CustomerNameHydration,
} from "../shared/customer-name";

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

export function customerNameHydrationById(
  ids: readonly string[],
  results: ReadonlyArray<{
    readonly name: string | undefined;
    readonly status: "pending" | "error" | "success";
    readonly notFound: boolean;
  }>,
): ReadonlyMap<string, CustomerNameHydration> {
  const map = new Map<string, CustomerNameHydration>();
  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    const result = results[index];
    if (id === undefined || result === undefined) {
      continue;
    }
    map.set(
      id,
      resolveCustomerNameHydration({
        customerId: id,
        name: result.name,
        status: result.status,
        notFound: result.notFound,
      }),
    );
  }
  return map;
}

export function customerNameHydrationEqual(
  left: CustomerNameHydration,
  right: CustomerNameHydration,
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  if (left.kind === "ready" && right.kind === "ready") {
    return left.name === right.name;
  }
  return true;
}

/** Keep the previous Map when contents match so list `rows` can bail. */
export function retainCustomerNameHydrationMap(
  previous: ReadonlyMap<string, CustomerNameHydration> | undefined,
  next: ReadonlyMap<string, CustomerNameHydration>,
): ReadonlyMap<string, CustomerNameHydration> {
  if (previous === undefined || previous.size !== next.size) {
    return next;
  }
  for (const [id, value] of next) {
    const prior = previous.get(id);
    if (prior === undefined || !customerNameHydrationEqual(prior, value)) {
      return next;
    }
  }
  return previous;
}

export function useOrderCustomerNames(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly getActiveCompany: () => string | null;
  readonly items: ReadonlyArray<{ readonly customerId: string | null }>;
}): {
  readonly hydrationByCustomerId: ReadonlyMap<string, CustomerNameHydration>;
  readonly refetch: () => void;
} {
  const customerIds = useMemo(
    () => uniqueCustomerIds(args.items),
    [args.items],
  );
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
  const nextHydration = customerNameHydrationById(
    customerIds,
    queries.map((query) => ({
      name: query.data?.name,
      status: query.status,
      notFound:
        query.isError && describeWireError(query.error)?.code === "NOT_FOUND",
    })),
  );
  const hydrationRef = useRef<
    ReadonlyMap<string, CustomerNameHydration> | undefined
  >(undefined);
  const hydrationByCustomerId = retainCustomerNameHydrationMap(
    hydrationRef.current,
    nextHydration,
  );
  hydrationRef.current = hydrationByCustomerId;
  const queriesRef = useRef(queries);
  queriesRef.current = queries;
  const refetch = useCallback(() => {
    for (const query of queriesRef.current) {
      void query.refetch();
    }
  }, []);

  return {
    hydrationByCustomerId,
    refetch,
  };
}
