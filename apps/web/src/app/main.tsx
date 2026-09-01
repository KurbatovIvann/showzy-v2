import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppProviders } from "./providers";
import { createAppRouter } from "./router";
import { createAppRuntime } from "./runtime";
import "../styles.css";

const { authClient } = createAppRuntime();
const router = createAppRouter({ authClient });

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Root element #root is missing in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders authClient={authClient}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
