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
import { authCopy, type AuthCopy } from "../i18n/auth";
import { detectLocale } from "../i18n/locale";
import {
  bindCompanySelectorPersistence,
  restoreLastCompanySelectorIfSignedIn,
} from "../prefs/device-prefs";
import { createPlatformDevicePrefs } from "../prefs/platform-storage";
import { isAuthClientError, type AuthErrorKind } from "./errors";
import { createAuthApi } from "./http";
import { createOtpFlow, type OtpFlow } from "./otp-flow";
import { createPlatformTokenStore } from "./secure-storage";
import { bindSessionController } from "./session-binding";
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
  readonly clearDeadSession: () => Promise<void>;
  readonly getAccessToken: () => string | null;
};

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

type AuthResources = {
  readonly session: SessionController;
  readonly flow: OtpFlow;
  readonly client: ContractClient;
};

export function AuthSessionProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const copy = useMemo(() => authCopy(detectLocale()), []);
  const [sessionUser, setSessionUser] = useState<SessionSnapshot | null>(null);
  const [bootError, setBootError] = useState<AuthErrorKind | null>(null);

  // Lazy singleton: the controllers are built once per mount, not re-created
  // by re-renders (a side-effectful useMemo would be).
  const [resources] = useState<AuthResources | null>(() => {
    let apiUrl: string;
    try {
      apiUrl = apiUrlFromEnv();
    } catch {
      return null;
    }
    const api = createAuthApi({ baseUrl: apiUrl });
    const inner = createSessionController({
      store: createPlatformTokenStore(),
      api,
    });
    const prefs = createPlatformDevicePrefs();
    const client = createShowzyClient({
      apiUrl,
      getAccessToken: () => inner.getAccessToken(),
    });
    bindCompanySelectorPersistence(client, prefs);
    // The flow does not exist yet when the binding is created; the closure
    // reads it after assignment below.
    let boundFlow: OtpFlow | null = null;
    const session = bindSessionController(inner, {
      onUser: (user) => {
        setSessionUser(user);
        restoreLastCompanySelectorIfSignedIn(client, prefs, user);
      },
      // Server-side revocation must not strand the user on a stale
      // verify screen.
      onRevoked: () => {
        boundFlow?.reset();
      },
    });
    const flow = createOtpFlow({ api, session });
    boundFlow = flow;
    return {
      session,
      flow,
      client,
    };
  });
  const [ready, setReady] = useState(resources === null);

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

  const clearDeadSession = useCallback(async () => {
    if (resources === null) {
      return;
    }
    await resources.session.clearDeadSession();
  }, [resources]);

  const value: AuthSessionValue = useMemo(
    () => ({
      status: !ready
        ? "loading"
        : sessionUser === null
          ? "anonymous"
          : "authenticated",
      session: sessionUser,
      bootError,
      configError: resources === null,
      copy,
      client: resources?.client ?? null,
      flow: resources?.flow ?? null,
      retryHydrate: hydrate,
      signOut,
      clearDeadSession,
      getAccessToken: () => resources?.session.getAccessToken() ?? null,
    }),
    [
      ready,
      sessionUser,
      bootError,
      resources,
      copy,
      hydrate,
      signOut,
      clearDeadSession,
    ],
  );

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
