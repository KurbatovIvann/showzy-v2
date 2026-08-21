import { describe, expect, it } from "vitest";

import {
  AUTH_COOKIE_KEY,
  AUTH_STORAGE_PREFIX,
  createMemoryAuthStorage,
} from "./storage";

describe("auth cookie storage", () => {
  it("round-trips cookie values in memory without a default session", () => {
    expect(AUTH_STORAGE_PREFIX).toBe("showzy");
    expect(AUTH_COOKIE_KEY).toBe("showzy_cookie");
    const store = createMemoryAuthStorage();
    expect(store.getItem(AUTH_COOKIE_KEY)).toBeNull();
    void store.setItem(
      AUTH_COOKIE_KEY,
      '{"better-auth.session_token":{"value":"x","expires":null}}',
    );
    expect(store.getItem(AUTH_COOKIE_KEY)).toContain("session_token");
    void store.setItem(AUTH_COOKIE_KEY, "");
    expect(store.getItem(AUTH_COOKIE_KEY)).toBeNull();
  });
});
