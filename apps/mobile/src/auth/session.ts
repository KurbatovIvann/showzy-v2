import { AuthClientError, isAuthClientError } from "./errors";
import type { AuthApi, AuthSessionUser } from "./http";
import type { TokenStore } from "./storage";

export type SessionSnapshot = AuthSessionUser;

export interface SessionController {
  hydrate(): Promise<SessionSnapshot | null>;
  refresh(): Promise<SessionSnapshot | null>;
  completeSignIn(token: string): Promise<SessionSnapshot>;
  signOut(): Promise<void>;
  /** Drop a locally stored session that the API already rejected (401). */
  clearDeadSession(): Promise<void>;
  getAccessToken(): string | null;
  getSnapshot(): SessionSnapshot | null;
}

export function createSessionController(deps: {
  readonly store: TokenStore;
  readonly api: Pick<AuthApi, "getSession" | "signOut">;
}): SessionController {
  let token: string | null = null;
  let snapshot: SessionSnapshot | null = null;

  async function clearLocal(): Promise<void> {
    token = null;
    snapshot = null;
    await deps.store.clear();
  }

  async function applyToken(next: string): Promise<SessionSnapshot | null> {
    token = next;
    await deps.store.set(next);
    return readRemote();
  }

  async function readRemote(): Promise<SessionSnapshot | null> {
    if (token === null) {
      return null;
    }
    try {
      const result = await deps.api.getSession(token);
      if (result.rotatedToken !== null && result.rotatedToken !== "") {
        token = result.rotatedToken;
        await deps.store.set(result.rotatedToken);
      }
      if (result.user === null) {
        await clearLocal();
        return null;
      }
      snapshot = result.user;
      return snapshot;
    } catch (error) {
      if (isAuthClientError(error) && error.kind === "unauthenticated") {
        await clearLocal();
        return null;
      }
      throw error;
    }
  }

  return {
    getAccessToken(): string | null {
      return token;
    },
    getSnapshot(): SessionSnapshot | null {
      return snapshot;
    },
    async hydrate() {
      token = await deps.store.get();
      if (token === null || token === "") {
        token = null;
        snapshot = null;
        return null;
      }
      return readRemote();
    },
    refresh() {
      return readRemote();
    },
    async completeSignIn(nextToken) {
      if (nextToken === "") {
        throw new AuthClientError("unavailable");
      }
      const user = await applyToken(nextToken);
      if (user === null) {
        throw new AuthClientError("unauthenticated");
      }
      return user;
    },
    async signOut() {
      const current = token;
      if (current !== null) {
        try {
          await deps.api.signOut(current);
        } catch {
          // Local revocation still wins — a dead server must not keep a token.
        }
      }
      await clearLocal();
    },
    async clearDeadSession() {
      await clearLocal();
    },
  };
}
