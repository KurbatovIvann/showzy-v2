/**
 * Panel SPA build (ADR-0030). The dev proxy keeps `/rpc` and `/api/auth`
 * same-origin against the local API — mirroring the production reverse
 * proxy — so session cookies work without any CORS surface.
 */
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Local API origin (`API_PORT` defaults to 3000 in @showzy/config). */
const DEV_API_ORIGIN = "http://localhost:3000";

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      "/rpc": { target: DEV_API_ORIGIN },
      "/api/auth": { target: DEV_API_ORIGIN },
    },
  },
});
