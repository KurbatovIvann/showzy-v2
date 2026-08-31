import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { QueryProvider } from "./api/query-provider";
import { createAppRouter } from "./router";
import "./styles.css";

const router = createAppRouter();

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Root element #root is missing in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryProvider>
      <RouterProvider router={router} />
    </QueryProvider>
  </StrictMode>,
);
