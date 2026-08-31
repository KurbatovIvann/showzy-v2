import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { act, render } from "@testing-library/react";

import { AppProviders } from "../app-providers";
import { createShowzyAuthClient } from "../auth/client";
import { createAppRouter } from "../router";

export async function renderApp(path: string) {
  const authClient = createShowzyAuthClient({
    // jsdom emits visibilitychange while attaching the tree. better-auth
    // then aborts the in-flight session-atom fetch and can leave
    // `isPending: true` (aborted flights do not clear pending). The
    // session-guard tests wait on the sign-in heading, which never
    // appears behind BootScreen — colliding with Vitest's 5s timeout
    // (SHO-316).
    sessionOptions: { refetchOnWindowFocus: false },
  });
  const router = createAppRouter({
    authClient,
    history: createMemoryHistory({ initialEntries: [path] }),
    // Router hides pending UI for defaultPendingMs (1s). That window
    // matches Testing Library's default findBy timeout, so a cold
    // getSession + redirect assertion sees an empty <div />.
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  });
  await act(async () => {
    render(
      <AppProviders authClient={authClient}>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    await router.load();
    // Session atom fetch is scheduled on setTimeout(0) in onMount.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  });
  return { authClient, router };
}
