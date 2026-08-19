import { describe, expect, it } from "vitest";

import { AuthClientError } from "./errors";
import { createSessionController } from "./session";
import { createMemoryTokenStore } from "./storage";
import type { AuthApi, GetSessionResult } from "./api";

function apiStub(handlers: {
  getSession?: (token: string) => Promise<GetSessionResult>;
  signOut?: (token: string) => Promise<void>;
}): Pick<AuthApi, "getSession" | "signOut"> {
  return {
    getSession: handlers.getSession ?? (() => Promise.reject(new Error("no"))),
    signOut: handlers.signOut ?? (() => Promise.resolve()),
  };
}

describe("session controller", () => {
  it("hydrates from storage and refreshes a rotated token", async () => {
    const store = createMemoryTokenStore("old-token");
    const seen: string[] = [];
    const session = createSessionController({
      store,
      api: apiStub({
        getSession: (token) => {
          seen.push(token);
          return Promise.resolve({
            user: {
              userId: "user-1",
              email: "a@b.c",
              phoneNumber: null,
            },
            rotatedToken: "new-token",
          });
        },
      }),
    });

    const snapshot = await session.hydrate();
    expect(snapshot?.userId).toBe("user-1");
    expect(session.getAccessToken()).toBe("new-token");
    expect(await store.get()).toBe("new-token");
    expect(seen).toEqual(["old-token"]);
  });

  it("clears storage when the server reports the session revoked", async () => {
    const store = createMemoryTokenStore("dead");
    const session = createSessionController({
      store,
      api: apiStub({
        getSession: () =>
          Promise.reject(new AuthClientError("unauthenticated")),
      }),
    });

    await expect(session.hydrate()).resolves.toBeNull();
    expect(session.getAccessToken()).toBeNull();
    expect(await store.get()).toBeNull();
  });

  it("keeps the token on a network error so a later refresh can succeed", async () => {
    const store = createMemoryTokenStore("live");
    let fail = true;
    const session = createSessionController({
      store,
      api: apiStub({
        getSession: () => {
          if (fail) {
            return Promise.reject(new AuthClientError("network"));
          }
          return Promise.resolve({
            user: { userId: "user-1", email: null, phoneNumber: "+380" },
            rotatedToken: null,
          });
        },
      }),
    });

    await expect(session.hydrate()).rejects.toMatchObject({ kind: "network" });
    expect(session.getAccessToken()).toBe("live");
    fail = false;
    await expect(session.refresh()).resolves.toMatchObject({
      userId: "user-1",
    });
  });

  it("persists a sign-in token and signs out even if the revoke call fails", async () => {
    const store = createMemoryTokenStore();
    let revoked = 0;
    const session = createSessionController({
      store,
      api: apiStub({
        getSession: (token) =>
          Promise.resolve({
            user: {
              userId: token === "fresh" ? "user-1" : "nope",
              email: null,
              phoneNumber: null,
            },
            rotatedToken: null,
          }),
        signOut: () => {
          revoked += 1;
          return Promise.reject(new AuthClientError("unavailable"));
        },
      }),
    });

    await session.completeSignIn("fresh");
    expect(await store.get()).toBe("fresh");
    expect(session.getSnapshot()?.userId).toBe("user-1");
    await session.signOut();
    expect(revoked).toBe(1);
    expect(session.getAccessToken()).toBeNull();
    expect(await store.get()).toBeNull();
  });
});
