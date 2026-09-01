import type { QueryClient } from "@tanstack/react-query";
import { createRouter, type RouterHistory } from "@tanstack/react-router";

import type { ShowzyClient } from "../api/client";
import type { ShowzyAuthClient } from "../auth/client";
import type { AuthSessionUser } from "../auth/session-user";
import { routeTree } from "../routeTree.gen";

export type AppRouterContext = {
  readonly authClient: ShowzyAuthClient;
  readonly queryClient: QueryClient;
  readonly apiClient: ShowzyClient;
  readonly session?: AuthSessionUser;
};

export function createAppRouter(options: {
  readonly authClient: ShowzyAuthClient;
  readonly queryClient: QueryClient;
  readonly apiClient: ShowzyClient;
  readonly history?: RouterHistory;
  readonly defaultPendingMs?: number;
  readonly defaultPendingMinMs?: number;
}) {
  return createRouter({
    routeTree,
    context: {
      authClient: options.authClient,
      queryClient: options.queryClient,
      apiClient: options.apiClient,
    },
    ...(options.history === undefined ? {} : { history: options.history }),
    ...(options.defaultPendingMs === undefined
      ? {}
      : { defaultPendingMs: options.defaultPendingMs }),
    ...(options.defaultPendingMinMs === undefined
      ? {}
      : { defaultPendingMinMs: options.defaultPendingMinMs }),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
