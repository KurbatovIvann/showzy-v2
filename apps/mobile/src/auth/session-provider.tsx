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
import { isPlaceholderEmail } from "./otp/identifiers";
import { createPlatformAuthStorage } from "./platform-storage";

export type AuthStatus = "loading" | "anonymous" | "authenticated";

export type AuthSessionUser = {
  readonly userId: string;
  readonly email: string | null;
  readonly phoneNumber: string | null;
};

export type AuthSessionValue = {
  readonly status: AuthStatus;
  readonly session: AuthSessionUser | null;
  readonly bootError: AuthErrorKind | null;
  readonly configError: boolean;
  readonly copy: AuthCopy;
  readonly retryHydrate: () => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly clearDeadSession: () => Promise<void>;
  readonly getCookie: () => string;
  readonly authClient: ShowzyAuthClient | null;
};

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

type BootState =
  | { readonly kind: "loading" }
  | { readonly kind: "config-error" }
  | { readonly kind: "hydrate-error" }
  | { readonly kind: "ready"; readonly client: ShowzyAuthClient };

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
          setBoot({ kind: "ready", client });
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

  if (boot.kind !== "ready") {
    const value: AuthSessionValue = {
      status: boot.kind === "loading" ? "loading" : "anonymous",
      session: null,
      bootError: boot.kind === "hydrate-error" ? bootError : null,
      configError: boot.kind === "config-error",
      copy,
      retryHydrate,
      signOut: () => Promise.resolve(),
      clearDeadSession: () => Promise.resolve(),
      getCookie: () => "",
      authClient: null,
    };
    return (
      <AuthSessionContext.Provider value={value}>
        {children}
      </AuthSessionContext.Provider>
    );
  }

  return (
    <SessionFromSdk
      authClient={boot.client}
      copy={copy}
      retryHydrate={retryHydrate}
    >
      {children}
    </SessionFromSdk>
  );
}

function SessionFromSdk({
  authClient,
  copy,
  retryHydrate,
  children,
}: {
  readonly authClient: ShowzyAuthClient;
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

  const signOut = useCallback(async () => {
    await authClient.signOut();
  }, [authClient]);

  const session = userFromSession(sessionQuery.data);
  const status: AuthStatus = sessionQuery.isPending
    ? "loading"
    : session === null
      ? "anonymous"
      : "authenticated";

  const value: AuthSessionValue = {
    status,
    session,
    bootError:
      status === "anonymous" ? mapSessionError(sessionQuery.error) : null,
    configError: false,
    copy,
    retryHydrate,
    signOut,
    clearDeadSession: signOut,
    getCookie: () => authClient.getCookie(),
    authClient,
  };

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

function mapSessionError(error: unknown): AuthErrorKind | null {
  if (error === null || error === undefined) {
    return null;
  }
  if (isAuthClientError(error)) {
    return error.kind;
  }
  if (typeof error === "object" && "status" in error) {
    const status = error.status;
    if (typeof status === "number" && status === 401) {
      return "unauthenticated";
    }
  }
  return "network";
}

function userFromSession(data: unknown): AuthSessionUser | null {
  if (typeof data !== "object" || data === null || !("user" in data)) {
    return null;
  }
  const user = data.user;
  if (typeof user !== "object" || user === null || !("id" in user)) {
    return null;
  }
  if (typeof user.id !== "string" || user.id === "") {
    return null;
  }
  const emailRaw =
    "email" in user && typeof user.email === "string" ? user.email : null;
  const email = emailRaw === "" ? null : emailRaw;
  const phoneRaw =
    "phoneNumber" in user && typeof user.phoneNumber === "string"
      ? user.phoneNumber
      : null;
  return {
    userId: user.id,
    email: isPlaceholderEmail(email) ? null : email,
    phoneNumber: phoneRaw === "" ? null : phoneRaw,
  };
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
