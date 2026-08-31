import { describe, expect, it } from "vitest";

import { clearLocalAuthJar, signOutClearingLocalJar } from "./sign-out";
import {
  AUTH_COOKIE_KEY,
  AUTH_SESSION_CACHE_KEY,
  createMemoryAuthStorage,
} from "./storage";

const DEAD_COOKIE =
  '{"better-auth.session_token":{"value":"dead","expires":null}}';

describe("signOutClearingLocalJar", () => {
  it("clears the local jar when the remote sign-out rejects", async () => {
    const storage = createMemoryAuthStorage({
      [AUTH_COOKIE_KEY]: DEAD_COOKIE,
      [AUTH_SESSION_CACHE_KEY]: '{"user":{"id":"u-1"}}',
    });
    await signOutClearingLocalJar({
      signOutRemote: () => Promise.reject(new TypeError("Failed to fetch")),
      storage,
    });
    expect(storage.getItem(AUTH_COOKIE_KEY)).toBeNull();
    expect(storage.getItem(AUTH_SESSION_CACHE_KEY)).toBeNull();
  });

  it("clears the local jar after a successful remote sign-out", async () => {
    const storage = createMemoryAuthStorage({
      [AUTH_COOKIE_KEY]: DEAD_COOKIE,
    });
    await signOutClearingLocalJar({
      signOutRemote: () => Promise.resolve(),
      storage,
    });
    expect(storage.getItem(AUTH_COOKIE_KEY)).toBeNull();
  });

  it("clearLocalAuthJar drops cookie and session cache keys", () => {
    const storage = createMemoryAuthStorage({
      [AUTH_COOKIE_KEY]: DEAD_COOKIE,
      [AUTH_SESSION_CACHE_KEY]: "{}",
    });
    clearLocalAuthJar(storage);
    expect(storage.getItem(AUTH_COOKIE_KEY)).toBeNull();
    expect(storage.getItem(AUTH_SESSION_CACHE_KEY)).toBeNull();
  });
});
