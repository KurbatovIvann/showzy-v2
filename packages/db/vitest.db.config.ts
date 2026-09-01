import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/**
 * Workspace DB suite (SHO-336): one Vitest process, one globalSetup, one
 * PostgreSQL template. Include/exclude must match
 * `packages/tooling/ci/test-suite-files.mjs`. CI collection lists this
 * config with `--filesOnly --staticParse` so globalSetup does not run.
 */
export default defineConfig({
  root: repoRoot,
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
  test: {
    name: "db",
    include: [
      "packages/**/*.db.test.ts",
      "apps/**/*.db.test.ts",
      "packages/db/src/**/*.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "packages/db/src/testing/ci-probe.test.ts",
      "packages/db/src/testing/schema-checks.test.ts",
      "packages/db/src/ops/backup-verify.test.ts",
    ],
    globalSetup: [
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "src/testing/global-setup.ts",
      ),
    ],
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 180_000,
    // Nested turbo×Vitest oversubscription is a unit-job concern. This job
    // is one process; two file workers keep CREATE DATABASE parallelism
    // bounded on GitHub-hosted 2–4 CPU runners. Do not shard.
    maxWorkers: process.env.GITHUB_ACTIONS === "true" ? 2 : 4,
    fileParallelism: true,
  },
});
