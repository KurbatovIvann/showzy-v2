/**
 * App-wide lifecycle composition (SHO-329 / SHO-330). Constructs the
 * auth client, contract client, and Query client so router loaders and
 * React providers share one cache. `QueryRuntimeProvider` binds
 * active-company lifecycle; that bind stays in `src/api`. This is not
 * a store and must not hold UI selection.
 */
import type { QueryClient } from "@tanstack/react-query";

import { createShowzyClient, type ShowzyClient } from "../api/client";
import { createWebQueryClient } from "../api/query-client";
import { createShowzyAuthClient, type ShowzyAuthClient } from "../auth/client";

export type AppRuntime = {
  readonly authClient: ShowzyAuthClient;
  readonly apiClient: ShowzyClient;
  readonly queryClient: QueryClient;
};

export function createAppRuntime(): AppRuntime {
  return {
    authClient: createShowzyAuthClient(),
    apiClient: createShowzyClient(),
    queryClient: createWebQueryClient(),
  };
}
