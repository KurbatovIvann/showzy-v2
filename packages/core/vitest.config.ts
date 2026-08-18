import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        // Pure unit tests — no containers, no Docker. Rule-matrix tests for
        // runContractCheck live here; the CI stage walks apps/api composition.
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.db.test.ts"],
        },
      },
      {
        // Integration tests against the shared Testcontainers Postgres
        // harness (db.md §8). Same timeout rationale as packages/db: the
        // first run also pulls the image.
        test: {
          name: "db",
          include: ["src/**/*.db.test.ts"],
          globalSetup: ["@showzy/db/testing/global-setup"],
          testTimeout: 120_000,
          hookTimeout: 180_000,
        },
      },
    ],
  },
});
