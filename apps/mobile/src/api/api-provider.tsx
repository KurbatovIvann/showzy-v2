import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useAuthSession } from "../auth/session-provider";
import { apiUrlFromEnv } from "./config";
import { createShowzyClient, type ContractClient } from "./client";

const ApiClientContext = createContext<ContractClient | null>(null);

/**
 * Contract client with the Expo session cookie. Must sit inside
 * `SessionProvider`. Fetch uses `credentials: "omit"` so the Cookie
 * header from `getCookie()` is not overwritten.
 */
export function ApiProvider({ children }: { readonly children: ReactNode }) {
  const auth = useAuthSession();
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

  return (
    <ApiClientContext.Provider value={client}>
      {children}
    </ApiClientContext.Provider>
  );
}

export function useApiClient(): ContractClient | null {
  return useContext(ApiClientContext);
}
