import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { act, cleanup, render } from "@testing-library/react";
import { onTestFinished } from "vitest";

import { AppProviders } from "../app/providers";
import { createAppRouter } from "../app/router";
import { createShowzyClient, type ShowzyClient } from "../api/client";
import {
  clearCachedContractQueries,
  createWebQueryClient,
} from "../api/query-client";
import {
  createShowzyAuthClient,
  disposeShowzyAuthClient,
  type ShowzyAuthClient,
} from "../auth/client";

export type RenderedApp = {
  readonly authClient: ShowzyAuthClient;
  readonly router: ReturnType<typeof createAppRouter>;
  readonly queryClient: ReturnType<typeof createWebQueryClient>;
  readonly apiClient: ShowzyClient;
};

let currentApp: RenderedApp | undefined;
let disposeHooked = false;

/**
 * Drop the live router/auth/query tree before the next `renderApp` (and
 * at test end). Sequential tables that only `cleanup()` leave memory
 * histories and session atoms alive; CI then sees an empty `<div />` /
 * leftover `.panel-shell` (SHO-332).
 */
export function disposeRenderedApp(): void {
  const app = currentApp;
  currentApp = undefined;
  cleanup();
  if (app === undefined) {
    return;
  }
  app.router.history.destroy();
  disposeShowzyAuthClient(app.authClient);
  clearCachedContractQueries(app.queryClient);
  app.apiClient.setActiveCompany(null);
}

function hookDisposeOnTestFinished(): void {
  if (disposeHooked) {
    return;
  }
  disposeHooked = true;
  onTestFinished(() => {
    disposeHooked = false;
    disposeRenderedApp();
  });
}

export async function renderApp(path: string): Promise<RenderedApp> {
  disposeRenderedApp();
  hookDisposeOnTestFinished();
  const authClient = createShowzyAuthClient({
    // jsdom emits visibilitychange while attaching the tree. better-auth
    // then aborts the in-flight session-atom fetch and can leave
    // `isPending: true` (aborted flights do not clear pending). The
    // session-guard tests wait on the sign-in heading, which never
    // appears behind BootScreen — colliding with Vitest's 5s timeout
    // (SHO-316).
    sessionOptions: { refetchOnWindowFocus: false },
  });
  const queryClient = createWebQueryClient({ retryQueries: false });
  const apiClient = createShowzyClient();
  const router = createAppRouter({
    authClient,
    history: createMemoryHistory({ initialEntries: [path] }),
    // Router hides pending UI for defaultPendingMs (1s). That window
    // matches Testing Library's default findBy timeout, so a cold
    // getSession + redirect assertion sees an empty <div />.
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  });
  const rendered: RenderedApp = {
    authClient,
    router,
    queryClient,
    apiClient,
  };
  currentApp = rendered;
  // Resolve matches before paint. Nesting `router.load()` inside `act`
  // with the session `setTimeout(0)` can deadlock under CI load and
  // leave RouterProvider as an empty `<div />` (SHO-332).
  await router.load();
  await act(async () => {
    render(
      <AppProviders
        authClient={authClient}
        client={apiClient}
        queryClient={queryClient}
      >
        <RouterProvider router={router} />
      </AppProviders>,
    );
    // Session atom fetch is scheduled on setTimeout(0) in onMount.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  });
  return rendered;
}
