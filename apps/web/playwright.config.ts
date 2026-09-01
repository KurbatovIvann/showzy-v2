/**
 * Built-app browser smoke (SHO-331). Serves `dist/` via `vite preview`.
 * Auth/RPC are intercepted in the test — never a production bypass.
 */
import { defineConfig } from "@playwright/test";

const previewOrigin = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }], ["list"]]
    : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: previewOrigin,
    locale: "uk-UA",
    timezoneId: "Europe/Kyiv",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "pnpm preview --host 127.0.0.1 --port 4173 --strictPort",
    url: previewOrigin,
    reuseExistingServer: process.env.CI === undefined,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
