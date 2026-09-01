import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppProviders } from "./providers";
import { createAppRouter } from "./router";
import { createAppRuntime } from "./runtime";
import "../styles.css";

const runtime = createAppRuntime();
const router = createAppRouter({
  authClient: runtime.authClient,
  queryClient: runtime.queryClient,
  apiClient: runtime.apiClient,
});

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Root element #root is missing in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders
      authClient={runtime.authClient}
      client={runtime.apiClient}
      queryClient={runtime.queryClient}
    >
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
