import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

import { useAuthSession } from "../auth/session-provider";
import {
  applySessionHydrateToCompanySelector,
  bindCompanySelectorPersistence,
} from "../prefs/device-prefs";
import { createPlatformDevicePrefs } from "../prefs/platform-storage";
import { createShowzyClient, type ContractClient } from "./client";
import { apiUrlFromEnv } from "./config";

const ApiClientContext = createContext<ContractClient | null>(null);

/**
 * Contract client with the Expo session cookie. Must sit inside
 * `SessionProvider`. Fetch uses `credentials: "omit"` so the Cookie
 * header from `getCookie()` is not overwritten.
 *
 * Company-selector persistence (SHO-103) binds here: the last staff
 * selector restores only after a live session hydrate. An unsigned
 * hydrate clears it so the next sign-in cannot inherit another user's
 * company. Network hydrate failures do not touch the stored selector.
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
      const created = createShowzyClient({
        apiUrl: apiUrlFromEnv(),
        getCookie: () => authClient.getCookie(),
      });
      bindCompanySelectorPersistence(created, prefs);
      return created;
    } catch {
      return null;
    }
  }, [auth.authClient, prefs]);

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

export function useApiClient(): ContractClient | null {
  return useContext(ApiClientContext);
}
