import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests boot a Testcontainers Postgres 17; the first run also
    // pulls the image. Generous timeouts keep CI stable, not slow — tests
    // finish as soon as the container is up.
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
});
