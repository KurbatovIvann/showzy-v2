import { createContext, useContext, type ReactNode } from "react";

import type { ShowzyClient } from "./client";

const ApiClientContext = createContext<ShowzyClient | null>(null);

/**
 * Contract client with browser session cookies (`credentials: "include"`).
 * Tenant cache isolation and last-slug persistence subscribe from
 * `QueryRuntimeProvider` (SHO-313). `client` is required so loaders and
 * React share the runtime from `createAppRuntime` — a fallback would
 * fork the cache.
 */
export function ApiProvider({
  children,
  client,
}: {
  readonly children: ReactNode;
  readonly client: ShowzyClient;
}) {
  return (
    <ApiClientContext.Provider value={client}>
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
