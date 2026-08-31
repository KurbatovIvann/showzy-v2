import { useCallback, useEffect, useMemo, useRef } from "react";

import type { AuthCopy } from "../i18n/auth";
import type { ShowzyAuthClient } from "./client";
import { isAuthClientError, type AuthErrorKind } from "./errors";
import { userFromSession, type AuthSessionUser } from "./session-user";
import { signOutClearingLocalJar } from "./sign-out";
import type { ExpoAuthStorage } from "./storage";

export type AuthStatus = "loading" | "anonymous" | "authenticated";

export type AuthSessionClient = {
  readonly getCookie: () => string;
  readonly signOut: () => Promise<unknown>;
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

export type BootSessionKind = "loading" | "config-error" | "hydrate-error";

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

/**
 * Boot-path context value. Identity is keyed on `kind` / `bootError` plus
 * the stable idle `getCookie` / `signOut` callbacks.
 */
export function useBootAuthSessionValue(args: {
  readonly kind: BootSessionKind;
  readonly bootError: AuthErrorKind | null;
  readonly copy: AuthCopy;
  readonly retryHydrate: () => Promise<void>;
}): AuthSessionValue {
  const signOut = useCallback((): Promise<void> => Promise.resolve(), []);
  const getCookie = useCallback((): string => "", []);

  return useMemo(
    (): AuthSessionValue => ({
      status: args.kind === "loading" ? "loading" : "anonymous",
      session: null,
      bootError: args.kind === "hydrate-error" ? args.bootError : null,
      configError: args.kind === "config-error",
      copy: args.copy,
      retryHydrate: args.retryHydrate,
      signOut,
      clearDeadSession: signOut,
      getCookie,
      authClient: null,
    }),
    [
      args.kind,
      args.bootError,
      args.copy,
      args.retryHydrate,
      signOut,
      getCookie,
    ],
  );
}

/**
 * Ready-path context value. `session` is memoized on primitive user fields
 * so an identical-session refetch keeps consumer identity stable.
 * `getCookie` / `signOut` are keyed on the auth client (and storage for
 * the jar-clearing contract); `refetch` is read from a ref so a new
 * `useSession().refetch` each render cannot churn the context value.
 */
export function useReadyAuthSessionValue<
  TClient extends AuthSessionClient,
>(args: {
  readonly data: unknown;
  readonly isPending: boolean;
  readonly error: unknown;
  readonly copy: AuthCopy;
  readonly retryHydrate: () => Promise<void>;
  readonly authClient: TClient;
  readonly storage: ExpoAuthStorage;
  readonly refetch: () => unknown;
}): Omit<AuthSessionValue, "authClient"> & { readonly authClient: TClient } {
  const parsed = userFromSession(args.data);
  const userId = parsed?.userId ?? null;
  const email = parsed?.email ?? null;
  const phoneNumber = parsed?.phoneNumber ?? null;

  const session = useMemo((): AuthSessionUser | null => {
    if (userId === null) {
      return null;
    }
    return { userId, email, phoneNumber };
  }, [userId, email, phoneNumber]);

  const getCookie = useCallback(
    (): string => args.authClient.getCookie(),
    [args.authClient],
  );

  const refetchRef = useRef(args.refetch);
  useEffect(() => {
    refetchRef.current = args.refetch;
  }, [args.refetch]);

  const signOut = useCallback(async () => {
    await signOutClearingLocalJar({
      signOutRemote: () => args.authClient.signOut(),
      storage: args.storage,
    });
    void refetchRef.current();
  }, [args.authClient, args.storage]);

  const status: AuthStatus = args.isPending
    ? "loading"
    : session === null
      ? "anonymous"
      : "authenticated";
  const bootError = status === "anonymous" ? mapSessionError(args.error) : null;

  return useMemo(
    () => ({
      status,
      session,
      bootError,
      configError: false,
      copy: args.copy,
      retryHydrate: args.retryHydrate,
      signOut,
      clearDeadSession: signOut,
      getCookie,
      authClient: args.authClient,
    }),
    [
      status,
      session,
      bootError,
      args.copy,
      args.retryHydrate,
      signOut,
      getCookie,
      args.authClient,
    ],
  );
}
