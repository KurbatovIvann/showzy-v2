import { afterEach, beforeAll } from "vitest";

import { ensureAuthServer, resetAuthMocks, server } from "./msw";

if (typeof navigator !== "undefined") {
  Object.defineProperty(navigator, "language", {
    configurable: true,
    value: "uk",
  });
}

beforeAll(() => {
  ensureAuthServer();
});

afterEach(() => {
  resetAuthMocks();
  server.resetHandlers();
});
