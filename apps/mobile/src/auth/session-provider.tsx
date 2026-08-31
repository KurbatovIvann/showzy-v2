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

import { apiUrlFromEnv, MobileConfigError } from "../api/config";
import { authCopy, type AuthCopy } from "../i18n/auth";
import { detectLocale } from "../i18n/locale";
import { createShowzyAuthClient, type ShowzyAuthClient } from "./client";
import { isAuthClientError, type AuthErrorKind } from "./errors";
import { createPlatformAuthStorage } from "./platform-storage";
import type { ExpoAuthStorage } from "./storage";
import {
  useBootAuthSessionValue,
  useReadyAuthSessionValue,
  type AuthSessionValue,
} from "./use-auth-session-value";

export type { AuthSessionUser } from "./session-user";
export type { AuthSessionValue, AuthStatus } from "./use-auth-session-value";

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

type BootState =
  | { readonly kind: "loading" }
  | { readonly kind: "config-error" }
  | { readonly kind: "hydrate-error" }
  | {
      readonly kind: "ready";
      readonly client: ShowzyAuthClient;
      readonly storage: ExpoAuthStorage;
    };

export function SessionProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const copy = useMemo(() => authCopy(detectLocale()), []);
  const [boot, setBoot] = useState<BootState>({ kind: "loading" });
  const [bootError, setBootError] = useState<AuthErrorKind | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function start(): Promise<void> {
      setBootError(null);
      try {
        const baseURL = apiUrlFromEnv();
        const storage = await createPlatformAuthStorage();
        const client = createShowzyAuthClient({ baseURL, storage });
        if (!cancelled) {
          setBoot({ kind: "ready", client, storage });
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (error instanceof MobileConfigError) {
          setBoot({ kind: "config-error" });
          return;
        }
        setBootError(isAuthClientError(error) ? error.kind : "network");
        setBoot({ kind: "hydrate-error" });
      }
    }
    void start();
    return () => {
      cancelled = true;
    };
  }, [generation]);

  const retryHydrate = useCallback((): Promise<void> => {
    setBoot({ kind: "loading" });
    setGeneration((value) => value + 1);
    return Promise.resolve();
  }, []);

  const bootValue = useBootAuthSessionValue({
    kind: boot.kind === "ready" ? "loading" : boot.kind,
    bootError,
    copy,
    retryHydrate,
  });

  if (boot.kind !== "ready") {
    return (
      <AuthSessionContext.Provider value={bootValue}>
        {children}
      </AuthSessionContext.Provider>
    );
  }

  return (
    <SessionFromSdk
      authClient={boot.client}
      storage={boot.storage}
      copy={copy}
      retryHydrate={retryHydrate}
    >
      {children}
    </SessionFromSdk>
  );
}

function SessionFromSdk({
  authClient,
  storage,
  copy,
  retryHydrate,
  children,
}: {
  readonly authClient: ShowzyAuthClient;
  readonly storage: ExpoAuthStorage;
  readonly copy: AuthCopy;
  readonly retryHydrate: () => Promise<void>;
  readonly children: ReactNode;
}) {
  const sessionQuery = authClient.useSession();

  const refetch = sessionQuery.refetch;

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        void refetch();
      }
    });
    return () => {
      sub.remove();
    };
  }, [refetch]);

  const value = useReadyAuthSessionValue({
    data: sessionQuery.data,
    isPending: sessionQuery.isPending,
    error: sessionQuery.error,
    copy,
    retryHydrate,
    authClient,
    storage,
    refetch,
  });

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession(): AuthSessionValue {
  const value = useContext(AuthSessionContext);
  if (value === null) {
    throw new Error("useAuthSession must be used within SessionProvider");
  }
  return value;
}

export function useAuthClient(): ShowzyAuthClient {
  const session = useAuthSession();
  if (session.authClient === null) {
    throw new Error("useAuthClient requires a configured auth client");
  }
  return session.authClient;
}
