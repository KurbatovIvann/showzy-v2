import type { SessionController, SessionSnapshot } from "./session";

/**
 * Wraps a session controller with UI notifications. `onUser` fires after
 * every state-changing call; `onRevoked` fires only when an existing
 * authenticated session disappears without an explicit sign-out (server
 * revocation), so an in-progress OTP flow is never reset by a background
 * refresh that simply finds no session.
 */
export function bindSessionController(
  inner: SessionController,
  hooks: {
    readonly onUser: (user: SessionSnapshot | null) => void;
    readonly onRevoked: () => void;
  },
): SessionController {
  async function trackRevocation(
    read: () => Promise<SessionSnapshot | null>,
  ): Promise<SessionSnapshot | null> {
    const hadSession = inner.getSnapshot() !== null;
    const user = await read();
    hooks.onUser(user);
    if (hadSession && user === null) {
      hooks.onRevoked();
    }
    return user;
  }

  return {
    getAccessToken: () => inner.getAccessToken(),
    getSnapshot: () => inner.getSnapshot(),
    hydrate: () => trackRevocation(() => inner.hydrate()),
    refresh: () => trackRevocation(() => inner.refresh()),
    async completeSignIn(token) {
      const user = await inner.completeSignIn(token);
      hooks.onUser(user);
      return user;
    },
    async signOut() {
      await inner.signOut();
      hooks.onUser(null);
    },
    async clearDeadSession() {
      const hadSession = inner.getSnapshot() !== null;
      await inner.clearDeadSession();
      hooks.onUser(null);
      if (hadSession) {
        hooks.onRevoked();
      }
    },
  };
}
