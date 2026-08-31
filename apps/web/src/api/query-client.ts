/**
 * TanStack Query client skeleton for the panel (SHO-309).
 *
 * Defaults mirror apps/mobile (SHO-102): reads stay warm for a minute,
 * mutations never auto-retry (idempotency attempts arrive with the
 * contract-client wiring in a later web ticket). Wire-error-aware retry
 * and 401 cache isolation land together with that client.
 */
import { QueryClient } from "@tanstack/react-query";

export const QUERY_STALE_TIME_MS = 60_000;
export const QUERY_GC_TIME_MS = 5 * 60_000;

export function createWebQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: QUERY_GC_TIME_MS,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
