import { describe, expect, it } from "vitest";

import { AuthClientError } from "./errors";
import { bindSessionController } from "./session-binding";
import { createSessionController } from "./session";
import { createMemoryTokenStore } from "./storage";
import type { AuthApi, GetSessionResult } from "./http";

type SessionApi = Pick<AuthApi, "getSession" | "signOut">;

function sessionApi(
  getSession: (token: string) => Promise<GetSessionResult>,
): SessionApi {
  return {
    getSession,
    signOut: () => Promise.resolve(),
  };
}

function liveUser(): GetSessionResult {
  return {
    user: { userId: "user-1", email: null, phoneNumber: "+380671112233" },
    rotatedToken: null,
  };
}

describe("bindSessionController", () => {
  it("fires onRevoked when the server drops an authenticated session", async () => {
    let alive = true;
    const users: Array<string | null> = [];
    let revoked = 0;
    const session = bindSessionController(
      createSessionController({
        store: createMemoryTokenStore("tok"),
        api: sessionApi(() => {
          if (alive) {
            return Promise.resolve(liveUser());
          }
          return Promise.reject(new AuthClientError("unauthenticated"));
        }),
      }),
      {
        onUser: (user) => users.push(user?.userId ?? null),
        onRevoked: () => {
          revoked += 1;
        },
      },
    );

    await session.hydrate();
    expect(users).toEqual(["user-1"]);
    expect(revoked).toBe(0);

    alive = false;
    await session.refresh();
    expect(users).toEqual(["user-1", null]);
    expect(revoked).toBe(1);
  });

  it("does not fire onRevoked for an anonymous refresh or a sign-out", async () => {
    let revoked = 0;
    const session = bindSessionController(
      createSessionController({
        store: createMemoryTokenStore(),
        api: sessionApi(() => Promise.resolve(liveUser())),
      }),
      {
        onUser: () => undefined,
        onRevoked: () => {
          revoked += 1;
        },
      },
    );

    // Background refresh while on the verify step: no session existed yet,
    // so the OTP flow must be left alone.
    await session.refresh();
    expect(revoked).toBe(0);

    await session.completeSignIn("fresh");
    await session.signOut();
    expect(revoked).toBe(0);
    expect(session.getAccessToken()).toBeNull();
  });
});
