import { createRouter, type RouterHistory } from "@tanstack/react-router";

import type { ShowzyAuthClient } from "../auth/client";
import { routeTree } from "../routeTree.gen";

export type AppRouterContext = {
  readonly authClient: ShowzyAuthClient;
};

export function createAppRouter(options: {
  readonly authClient: ShowzyAuthClient;
  readonly history?: RouterHistory;
  readonly defaultPendingMs?: number;
  readonly defaultPendingMinMs?: number;
}) {
  return createRouter({
    routeTree,
    context: { authClient: options.authClient },
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
