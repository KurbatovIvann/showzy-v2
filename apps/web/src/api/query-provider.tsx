import {
  QueryClientProvider,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuthSession } from "../auth/session-provider";
import { createBrowserCompanyPrefs } from "../prefs/companies/company-prefs";
import { bindActiveCompanyRuntime } from "./active-company-runtime";
import { useApiClient } from "./api-provider";
import { isolateCacheOnSessionLoss } from "./query-client";

export type QueryRuntimeValue = {
  readonly activeCompanyId: string | null;
  readonly setActiveCompany: (companyId: string | null) => void;
};

const QueryRuntimeContext = createContext<QueryRuntimeValue | null>(null);

export function QueryProvider({
  children,
  queryClient,
}: {
  readonly children: ReactNode;
  /** Required — a fallback `createWebQueryClient()` would fork loader prefetch. */
  readonly queryClient: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

/**
 * Binds `setActiveCompany` to tenant-cache isolation and exposes the live
 * selector so company-scoped queries re-render on switch (SHO-313).
 */
export function QueryRuntimeProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const auth = useAuthSession();
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const previousStatus = useRef(auth.status);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(() =>
    apiClient.getActiveCompany(),
  );

  useEffect(() => {
    return bindActiveCompanyRuntime({
      client: apiClient,
      queryClient,
      prefs: createBrowserCompanyPrefs(),
      onCompanyId: setActiveCompanyId,
    });
  }, [apiClient, queryClient]);

  useEffect(() => {
    isolateCacheOnSessionLoss(previousStatus.current, auth.status, {
      client: apiClient,
      queryClient,
    });
    previousStatus.current = auth.status;
  }, [auth.status, apiClient, queryClient]);

  const setActiveCompany = useCallback(
    (companyId: string | null) => {
      apiClient.setActiveCompany(companyId);
    },
    [apiClient],
  );

  const value = useMemo(
    (): QueryRuntimeValue => ({
      activeCompanyId,
      setActiveCompany,
    }),
    [activeCompanyId, setActiveCompany],
  );

  return (
    <QueryRuntimeContext.Provider value={value}>
      {children}
    </QueryRuntimeContext.Provider>
  );
}

export function useActiveCompany(): QueryRuntimeValue {
  const value = useContext(QueryRuntimeContext);
  if (value === null) {
    throw new Error(
      "useActiveCompany must be used within QueryRuntimeProvider",
    );
  }
  return value;
}
