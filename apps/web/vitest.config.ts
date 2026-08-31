import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.{ts,tsx}", "eslint/**/*.test.mjs"],
      setupFiles: ["./src/test/setup.ts"],
      // Above RTL `asyncUtilTimeout` (8s) so a missed heading fails with
      // "Unable to find", not "Test timed out" (SHO-316).
      testTimeout: 15_000,
      hookTimeout: 15_000,
    },
  }),
);
