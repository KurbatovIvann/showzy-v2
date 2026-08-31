import { QueryClientProvider } from "@tanstack/react-query";
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
import { createPlatformDevicePrefs } from "../prefs/platform-storage";
import { bindActiveCompanyRuntime } from "./active-company-runtime";
import { useApiClient } from "./api-provider";
import {
  createShowzyQueryClient,
  handleUnauthenticatedQueryError,
  hasLocalSession,
  isolateCacheOnSessionLoss,
  resetTenantQueryState,
} from "./query-client";
import { setupQueryPlatform } from "./query-platform";

export type QueryRuntimeValue = {
  readonly activeCompanyId: string | null;
  readonly setActiveCompany: (companyId: string | null) => void;
};

const QueryRuntimeContext = createContext<QueryRuntimeValue | null>(null);

/**
 * Root QueryClient + platform managers. Must sit inside SessionProvider
 * and ApiProvider so 401 handling can clear a dead session.
 *
 * Screens pass `activeCompanyId` into `contractQueryOptions` so a company
 * switch re-renders new keys before leftover rows can be reused.
 */
export function QueryRuntimeProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const auth = useAuthSession();
  const apiClient = useApiClient();
  const authRef = useRef(auth);
  authRef.current = auth;
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const previousStatus = useRef(auth.status);
  const queryClientRef = useRef<ReturnType<
    typeof createShowzyQueryClient
  > | null>(null);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(
    () => apiClient?.getActiveCompany() ?? null,
  );

  const [queryClient] = useState(() => {
    const client = createShowzyQueryClient({
      onUnauthenticated: () => {
        const current = queryClientRef.current;
        if (current === null) {
          return;
        }
        return handleUnauthenticatedQueryError({
          hadSession: hasLocalSession(authRef.current.getCookie()),
          clearSession: () => authRef.current.clearDeadSession(),
          clearCache: () => {
            resetTenantQueryState({
              client: apiRef.current,
              queryClient: current,
            });
          },
        });
      },
    });
    queryClientRef.current = client;
    return client;
  });

  useEffect(() => setupQueryPlatform(), []);

  useEffect(() => {
    if (apiClient === null) {
      return;
    }
    return bindActiveCompanyRuntime({
      client: apiClient,
      prefs: createPlatformDevicePrefs(),
      queryClient,
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
      apiClient?.setActiveCompany(companyId);
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
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
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
