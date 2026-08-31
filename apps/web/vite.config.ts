/**
 * Panel SPA build (ADR-0030). The dev proxy keeps `/rpc` and `/api/auth`
 * same-origin against the local API — mirroring the production reverse
 * proxy — so session cookies work without any CORS surface.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, searchForWorkspaceRoot } from "vite";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const validationSrc = path.resolve(appRoot, "../../packages/validation/src");

/** Local API origin (`API_PORT` defaults to 3000 in @showzy/config). */
const DEV_API_ORIGIN = "http://localhost:3000";

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@showzy/validation/catalog": path.join(validationSrc, "catalog.ts"),
      "@showzy/validation/customers": path.join(validationSrc, "customers.ts"),
      "@showzy/validation/money": path.join(validationSrc, "money.ts"),
      "@showzy/validation/pagination": path.join(
        validationSrc,
        "pagination.ts",
      ),
      "@showzy/validation/slug": path.join(validationSrc, "slug.ts"),
    },
  },
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(appRoot)],
    },
    proxy: {
      "/rpc": { target: DEV_API_ORIGIN },
      "/api/auth": { target: DEV_API_ORIGIN },
    },
  },
});
