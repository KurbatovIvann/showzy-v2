import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppProviders } from "./app-providers";
import { createShowzyAuthClient } from "./auth/client";
import { createAppRouter } from "./router";
import "./styles.css";

const authClient = createShowzyAuthClient();
const router = createAppRouter({ authClient });

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Root element #root is missing in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders authClient={authClient}>
      <RouterProvider router={router} context={{ authClient }} />
    </AppProviders>
  </StrictMode>,
);
