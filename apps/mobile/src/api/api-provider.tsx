import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

import { useAuthSession } from "../auth/session-provider";
import { applySessionHydrateToCompanySelector } from "../prefs/device-prefs";
import { createPlatformDevicePrefs } from "../prefs/platform-storage";
import { createShowzyClient, type ShowzyClient } from "./client";
import { apiUrlFromEnv } from "./config";

const ApiClientContext = createContext<ShowzyClient | null>(null);

/**
 * Contract client with the Expo session cookie. Must sit inside
 * `SessionProvider`. Fetch uses `credentials: "omit"` so the Cookie
 * header from `getCookie()` is not overwritten.
 *
 * Last-company restore runs here after a live session hydrate (SHO-103).
 * Persistence of the selector and tenant-cache isolation subscribe to
 * `onActiveCompanyChange` from `QueryRuntimeProvider` (SHO-297).
 */
export function ApiProvider({ children }: { readonly children: ReactNode }) {
  const auth = useAuthSession();
  const prefs = useMemo(() => createPlatformDevicePrefs(), []);
  const client = useMemo(() => {
    if (auth.authClient === null) {
      return null;
    }
    const authClient = auth.authClient;
    try {
      return createShowzyClient({
        apiUrl: apiUrlFromEnv(),
        getCookie: () => authClient.getCookie(),
      });
    } catch {
      return null;
    }
  }, [auth.authClient]);

  const sessionUserId = auth.session?.userId ?? null;

  useEffect(() => {
    if (client === null || auth.status === "loading") {
      return;
    }
    if (auth.bootError === "network") {
      return;
    }
    applySessionHydrateToCompanySelector(
      client,
      prefs,
      sessionUserId === null ? null : { userId: sessionUserId },
    );
  }, [client, auth.status, auth.bootError, sessionUserId, prefs]);

  return (
    <ApiClientContext.Provider value={client}>
      {children}
    </ApiClientContext.Provider>
  );
}

export function useApiClient(): ShowzyClient | null {
  return useContext(ApiClientContext);
}
