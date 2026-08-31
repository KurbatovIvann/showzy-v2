import { configure } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach } from "vitest";

import { ensureAuthServer, resetAuthMocks, server } from "./msw";

// Must stay below Vitest `testTimeout` in vitest.config.ts. When they
// are equal, `findBy` cannot throw "Unable to find" — Vitest reports
// "Test timed out in 5000ms" instead (SHO-316).
configure({ asyncUtilTimeout: 8_000 });

if (typeof navigator !== "undefined") {
  Object.defineProperty(navigator, "language", {
    configurable: true,
    value: "uk",
  });
}

beforeAll(() => {
  ensureAuthServer();
});

beforeEach(() => {
  resetAuthMocks();
  server.resetHandlers();
});

afterEach(() => {
  resetAuthMocks();
  server.resetHandlers();
});
