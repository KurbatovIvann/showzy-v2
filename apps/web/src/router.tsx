import { createRouter, type RouterHistory } from "@tanstack/react-router";

import type { ShowzyAuthClient } from "./auth/client";
import { routeTree } from "./routeTree.gen";

export type AppRouterContext = {
  readonly authClient: ShowzyAuthClient;
};

export function createAppRouter(options: {
  readonly authClient: ShowzyAuthClient;
  readonly history?: RouterHistory;
}) {
  return createRouter({
    routeTree,
    context: { authClient: options.authClient },
    ...(options.history === undefined ? {} : { history: options.history }),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
