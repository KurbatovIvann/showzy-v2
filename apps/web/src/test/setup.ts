import { configure } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach } from "vitest";

import { DEVICE_PREF_LAST_COMPANY_SLUG_KEY } from "../prefs/storage";
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

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): ResizeObserverEntry[] {
      return [];
    }
  };
}

beforeAll(() => {
  ensureAuthServer();
});

function clearLastCompanySlugPref(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(DEVICE_PREF_LAST_COMPANY_SLUG_KEY);
}

beforeEach(() => {
  resetAuthMocks();
  server.resetHandlers();
  clearLastCompanySlugPref();
});

afterEach(() => {
  resetAuthMocks();
  server.resetHandlers();
  clearLastCompanySlugPref();
});
