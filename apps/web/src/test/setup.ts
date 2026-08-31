import { configure } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach } from "vitest";

import { ensureAuthServer, resetAuthMocks, server } from "./msw";

configure({ asyncUtilTimeout: 5_000 });

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
