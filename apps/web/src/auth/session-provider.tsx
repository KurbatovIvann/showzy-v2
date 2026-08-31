import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { authCopy, type AuthCopy } from "../i18n/auth";
import { detectLocale } from "../i18n/locale";
import type { ShowzyAuthClient } from "./client";
import { isAuthClientError, type AuthErrorKind } from "./errors";
import { userFromSession, type AuthSessionUser } from "./session-user";

export type AuthStatus = "loading" | "anonymous" | "authenticated";

export type AuthSessionValue = {
  readonly status: AuthStatus;
  readonly session: AuthSessionUser | null;
  readonly bootError: AuthErrorKind | null;
  readonly copy: AuthCopy;
  readonly retryHydrate: () => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly authClient: ShowzyAuthClient;
};

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

export function SessionProvider({
  authClient,
  children,
}: {
  readonly authClient: ShowzyAuthClient;
  readonly children: ReactNode;
}) {
  const copy = useMemo(() => {
    const locale = typeof navigator === "undefined" ? "uk" : navigator.language;
    return authCopy(detectLocale(locale));
  }, []);
  const sessionQuery = authClient.useSession();
  const refetch = sessionQuery.refetch;

  const signOut = useCallback(async () => {
    await authClient.signOut();
  }, [authClient]);

  const retryHydrate = useCallback(async () => {
    await refetch();
  }, [refetch]);

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
    copy,
    retryHydrate,
    signOut,
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

export function useAuthSession(): AuthSessionValue {
  const value = useContext(AuthSessionContext);
  if (value === null) {
    throw new Error("useAuthSession must be used within SessionProvider");
  }
  return value;
}

export function useAuthClient(): ShowzyAuthClient {
  return useAuthSession().authClient;
}
