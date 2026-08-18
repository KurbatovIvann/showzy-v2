import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        // Pure unit tests — no containers, no Docker: the wire table, the
        // contract-router composition rules, and the AI manifest source.
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.db.test.ts"],
        },
      },
      {
        // Transport integration against the shared Testcontainers Postgres
        // harness: the server router runs real actions through the core
        // pipeline. Same timeout rationale as packages/db: the first run
        // also pulls the image.
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
