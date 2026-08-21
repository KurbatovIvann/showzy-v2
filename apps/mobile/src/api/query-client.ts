/**
 * TanStack Query client for contract reads/writes (SHO-102).
 *
 * Domain cache is in-memory only. Query keys must include the company
 * selector (or the null-company namespace); oRPC context is not in the key.
 */
import {
  MutationCache,
  QueryCache,
  QueryClient,
  type QueryClientConfig,
} from "@tanstack/react-query";
import { isWireError, type ContractClient } from "@showzy/contract";

import { StaleCompanyQueryError } from "./query-options";

/** V1 `staleTime` — keep reads warm for a minute unless a test proves otherwise. */
export const QUERY_STALE_TIME_MS = 60_000;
export const QUERY_GC_TIME_MS = 5 * 60_000;
/** Retries after the first failure for retryable query errors. */
export const QUERY_RETRY_LIMIT = 3;

export type QueryRetryDelay = NonNullable<
  NonNullable<
    NonNullable<QueryClientConfig["defaultOptions"]>["queries"]
  >["retryDelay"]
>;

const RETRYABLE_WIRE_CODES = new Set(["TIMEOUT", "RATE_LIMITED"]);

export function isRetryableQueryFailure(error: unknown): boolean {
  if (error instanceof StaleCompanyQueryError) {
    return false;
  }
  if (isWireError(error)) {
    return RETRYABLE_WIRE_CODES.has(error.code);
  }
  return true;
}

export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
): boolean {
  return failureCount < QUERY_RETRY_LIMIT && isRetryableQueryFailure(error);
}

export function queryRetryDelay(attemptIndex: number, error: unknown): number {
  if (isWireError(error) && error.code === "RATE_LIMITED") {
    return error.data.retryAfterSec * 1000;
  }
  return Math.min(1_000 * 2 ** attemptIndex, 30_000);
}

export function isUnauthenticatedWireError(error: unknown): boolean {
  return isWireError(error) && error.code === "UNAUTHENTICATED";
}

export function clearCachedContractQueries(queryClient: QueryClient): void {
  void queryClient.cancelQueries();
  queryClient.clear();
}

export function hasLocalSession(cookie: string | null | undefined): boolean {
  return cookie !== undefined && cookie !== null && cookie !== "";
}

export type QueryAuthStatus = "loading" | "anonymous" | "authenticated";

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

/**
 * Public/share calls must still run without a session. A 401 only clears
 * cache when a local session existed (dead cookie), never as a gate.
 */
export function handleUnauthenticatedQueryError(input: {
  readonly hadSession: boolean;
  readonly clearSession: () => void;
  readonly clearCache: () => void;
}): void {
  if (!input.hadSession) {
    return;
  }
  input.clearSession();
  input.clearCache();
}

export function bindActiveCompanyQueryIsolation(
  client: Pick<ContractClient, "setActiveCompany">,
  queryClient: QueryClient,
  hooks: {
    readonly onCompanyId?: (companyId: string | null) => void;
  } = {},
): () => void {
  const original = client.setActiveCompany.bind(client);
  client.setActiveCompany = (companyId: string | null): void => {
    original(companyId);
    hooks.onCompanyId?.(companyId);
    clearCachedContractQueries(queryClient);
  };
  return (): void => {
    client.setActiveCompany = original;
  };
}

export function createShowzyQueryClient(
  options: {
    readonly onUnauthenticated?: () => void;
    readonly retryDelay?: QueryRetryDelay;
  } = {},
): QueryClient {
  const onUnauthenticated = options.onUnauthenticated;
  const retryDelay = options.retryDelay ?? queryRetryDelay;

  function notifyIfUnauthenticated(error: unknown): void {
    if (isUnauthenticatedWireError(error)) {
      onUnauthenticated?.();
    }
  }

  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        notifyIfUnauthenticated(error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        notifyIfUnauthenticated(error);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: QUERY_GC_TIME_MS,
        retry: shouldRetryQuery,
        retryDelay,
      },
      mutations: {
        retry: 0,
        // Do not pause/resume mutations across reconnect (no offline queue).
        networkMode: "always",
      },
    },
  });
}
