import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";

import { AppProviders } from "../app-providers";
import { createShowzyAuthClient } from "../auth/client";
import { createAppRouter } from "../router";

export function renderApp(path: string) {
  const authClient = createShowzyAuthClient();
  const router = createAppRouter({
    authClient,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <AppProviders authClient={authClient}>
      <RouterProvider router={router} context={{ authClient }} />
    </AppProviders>,
  );
  return { authClient, router };
}
