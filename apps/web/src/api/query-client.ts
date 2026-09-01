/**
 * TanStack Query client for the panel (SHO-309, SHO-313).
 *
 * Defaults mirror apps/mobile (SHO-102): reads stay warm for a minute,
 * mutations never auto-retry. Company-scoped keys are dropped on
 * `setActiveCompany`; account/null-company rows stay.
 */
import { QueryClient, type QueryClientConfig } from "@tanstack/react-query";
import type { ContractClient } from "@showzy/contract";

import type { ActiveCompanyListenerHost } from "./client";
import { NULL_COMPANY_QUERY_SCOPE } from "./query-options";

export const QUERY_STALE_TIME_MS = 60_000;
export const QUERY_GC_TIME_MS = 5 * 60_000;

export type QueryAuthStatus = "loading" | "anonymous" | "authenticated";

export function createWebQueryClient(
  options: { readonly retryQueries?: boolean } = {},
): QueryClient {
  const retryQueries = options.retryQueries ?? true;
  const config: QueryClientConfig = {
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: QUERY_GC_TIME_MS,
        ...(retryQueries ? {} : { retry: false }),
      },
      mutations: {
        retry: 0,
      },
    },
  };
  return new QueryClient(config);
}

export function clearCachedContractQueries(queryClient: QueryClient): void {
  void queryClient.cancelQueries().catch(() => {
    // Cancelled in-flight queries must not become unhandled rejections.
  });
  queryClient.clear();
}

export function clearCachedTenantQueries(queryClient: QueryClient): void {
  const isTenantScoped = (query: { readonly queryKey: readonly unknown[] }) =>
    query.queryKey[1] !== NULL_COMPANY_QUERY_SCOPE;
  void queryClient.cancelQueries({ predicate: isTenantScoped }).catch(() => {
    // Cancelled in-flight tenant queries must not become unhandled rejections.
  });
  queryClient.removeQueries({ predicate: isTenantScoped });
}

/**
 * Drop the previous tenant selector and the cache so the next session
 * cannot inherit leftover rows or `x-company-id`.
 */
export function resetTenantQueryState(deps: {
  readonly client: Pick<ContractClient, "setActiveCompany"> | null;
  readonly queryClient: QueryClient;
}): void {
  deps.client?.setActiveCompany(null);
  clearCachedContractQueries(deps.queryClient);
}

export function isolateCacheOnSessionLoss(
  previousStatus: QueryAuthStatus,
  nextStatus: QueryAuthStatus,
  deps: {
    readonly client: Pick<ContractClient, "setActiveCompany"> | null;
    readonly queryClient: QueryClient;
  },
): void {
  if (previousStatus !== "authenticated" || nextStatus !== "anonymous") {
    return;
  }
  resetTenantQueryState(deps);
}

export function bindActiveCompanyQueryIsolation(
  client: ActiveCompanyListenerHost,
  queryClient: QueryClient,
  hooks: {
    readonly onCompanyId?: (companyId: string | null) => void;
  } = {},
): () => void {
  return client.onActiveCompanyChange((companyId) => {
    hooks.onCompanyId?.(companyId);
    clearCachedTenantQueries(queryClient);
  });
}
