import { createContext, useContext, useMemo, type ReactNode } from "react";

import { createShowzyClient, type ContractClient } from "./client";

const ApiClientContext = createContext<ContractClient | null>(null);

/**
 * Contract client with browser session cookies (`credentials: "include"`).
 * Company-selector persistence lands with the company-scope ticket.
 */
export function ApiProvider({ children }: { readonly children: ReactNode }) {
  const client = useMemo(() => createShowzyClient(), []);
  return (
    <ApiClientContext.Provider value={client}>
      {children}
    </ApiClientContext.Provider>
  );
}

export function useApiClient(): ContractClient {
  const client = useContext(ApiClientContext);
  if (client === null) {
    throw new Error("useApiClient must be used within ApiProvider");
  }
  return client;
}
