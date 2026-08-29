import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "eslint/**/*.test.mjs"],
    exclude: ["src/**/*.db.test.ts"],
  },
});
