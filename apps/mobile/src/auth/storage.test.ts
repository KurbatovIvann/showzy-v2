import { describe, expect, it } from "vitest";

import { ACCESS_TOKEN_KEY, createMemoryTokenStore } from "./storage";

describe("token store", () => {
  it("round-trips, overwrites, and clears without exposing a default token", async () => {
    const store = createMemoryTokenStore();
    expect(ACCESS_TOKEN_KEY).toBe("showzy.auth.access-token");
    expect(await store.get()).toBeNull();
    await store.set("tok-1");
    expect(await store.get()).toBe("tok-1");
    await store.set("tok-2");
    expect(await store.get()).toBe("tok-2");
    await store.clear();
    expect(await store.get()).toBeNull();
  });
});
