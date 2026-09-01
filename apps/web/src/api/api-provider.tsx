import { createContext, useContext, useMemo, type ReactNode } from "react";

import { createShowzyClient, type ShowzyClient } from "./client";

const ApiClientContext = createContext<ShowzyClient | null>(null);

/**
 * Contract client with browser session cookies (`credentials: "include"`).
 * Tenant cache isolation and last-slug persistence subscribe from
 * `QueryRuntimeProvider` (SHO-313).
 */
export function ApiProvider({
  children,
  client,
}: {
  readonly children: ReactNode;
  readonly client?: ShowzyClient;
}) {
  const resolved = useMemo(() => client ?? createShowzyClient(), [client]);
  return (
    <ApiClientContext.Provider value={resolved}>
      {children}
    </ApiClientContext.Provider>
  );
}

export function useApiClient(): ShowzyClient {
  const value = useContext(ApiClientContext);
  if (value === null) {
    throw new Error("useApiClient must be used within ApiProvider");
  }
  return value;
}
