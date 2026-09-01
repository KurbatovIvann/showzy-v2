import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: [
            "src/testing/ci-probe.test.ts",
            "src/testing/schema-checks.test.ts",
            "src/ops/backup-verify.test.ts",
          ],
        },
      },
      {
        test: {
          name: "db",
          include: ["src/**/*.test.ts"],
          exclude: [
            "src/testing/ci-probe.test.ts",
            "src/testing/schema-checks.test.ts",
            "src/ops/backup-verify.test.ts",
          ],
          globalSetup: ["./src/testing/global-setup.ts"],
          testTimeout: 120_000,
          hookTimeout: 180_000,
        },
      },
    ],
  },
});
