import { describe, expect, it } from "vitest";

import { AUTH_STORAGE_PREFIX, createMemoryAuthStorage } from "./storage";

describe("auth cookie storage", () => {
  it("round-trips cookie values in memory without a default session", () => {
    expect(AUTH_STORAGE_PREFIX).toBe("showzy");
    const store = createMemoryAuthStorage();
    expect(store.getItem("showzy_cookie")).toBeNull();
    void store.setItem(
      "showzy_cookie",
      '{"better-auth.session_token":{"value":"x","expires":null}}',
    );
    expect(store.getItem("showzy_cookie")).toContain("session_token");
    void store.setItem("showzy_cookie", "");
    expect(store.getItem("showzy_cookie")).toBeNull();
  });
});
