import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import { apiUrlFromEnv } from "../api/config";
import { createShowzyClient, type ContractClient } from "../api/client";
import { createAuthApi } from "./api";
import { authCopy, detectAuthLocale, type AuthCopy } from "./copy";
import { isAuthClientError, type AuthErrorKind } from "./errors";
import { createOtpFlow, type OtpFlow } from "./otp-flow";
import { createPlatformTokenStore } from "./secure-storage";
import {
  createSessionController,
  type SessionController,
  type SessionSnapshot,
} from "./session";

export type AuthStatus = "loading" | "anonymous" | "authenticated";

export type AuthSessionValue = {
  readonly status: AuthStatus;
  readonly session: SessionSnapshot | null;
  readonly bootError: AuthErrorKind | null;
  readonly configError: boolean;
  readonly copy: AuthCopy;
  readonly client: ContractClient | null;
  readonly flow: OtpFlow | null;
  readonly retryHydrate: () => Promise<void>;
  readonly signOut: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

export function AuthSessionProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const copy = useMemo(() => authCopy(detectAuthLocale()), []);
  const apiUrl = useMemo(() => {
    try {
      return apiUrlFromEnv();
    } catch {
      return null;
    }
  }, []);

  const [sessionUser, setSessionUser] = useState<SessionSnapshot | null>(null);
  const [ready, setReady] = useState(apiUrl === null);
  const [bootError, setBootError] = useState<AuthErrorKind | null>(null);

  const resources = useMemo(() => {
    if (apiUrl === null) {
      return null;
    }
    const api = createAuthApi({ baseUrl: apiUrl });
    const inner = createSessionController({
      store: createPlatformTokenStore(),
      api,
    });
    const session: SessionController = {
      getAccessToken: () => inner.getAccessToken(),
      getSnapshot: () => inner.getSnapshot(),
      async hydrate() {
        const user = await inner.hydrate();
        setSessionUser(user);
        return user;
      },
      async refresh() {
        const user = await inner.refresh();
        setSessionUser(user);
        return user;
      },
      async completeSignIn(token) {
        const user = await inner.completeSignIn(token);
        setSessionUser(user);
        return user;
      },
      async signOut() {
        await inner.signOut();
        setSessionUser(null);
      },
    };
    return {
      session,
      flow: createOtpFlow({ api, session }),
      client: createShowzyClient({
        apiUrl,
        getAccessToken: () => inner.getAccessToken(),
      }),
    };
  }, [apiUrl]);

  const hydrate = useCallback(async () => {
    if (resources === null) {
      return;
    }
    setBootError(null);
    try {
      await resources.session.hydrate();
    } catch (error) {
      setBootError(isAuthClientError(error) ? error.kind : "network");
    } finally {
      setReady(true);
    }
  }, [resources]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (resources === null) {
      return;
    }
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        void resources.session.refresh().catch(() => undefined);
      }
    });
    return () => {
      sub.remove();
    };
  }, [resources]);

  const signOut = useCallback(async () => {
    if (resources === null) {
      return;
    }
    await resources.session.signOut();
    resources.flow.reset();
  }, [resources]);

  const value: AuthSessionValue = {
    status: !ready
      ? "loading"
      : sessionUser === null
        ? "anonymous"
        : "authenticated",
    session: sessionUser,
    bootError,
    configError: apiUrl === null,
    copy,
    client: resources?.client ?? null,
    flow: resources?.flow ?? null,
    retryHydrate: hydrate,
    signOut,
  };

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession(): AuthSessionValue {
  const value = useContext(AuthSessionContext);
  if (value === null) {
    throw new Error("useAuthSession must be used within AuthSessionProvider");
  }
  return value;
}
