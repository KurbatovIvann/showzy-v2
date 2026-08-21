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
import {
  bindActiveCompanyQueryIsolation,
  createShowzyQueryClient,
  handleUnauthenticatedQueryError,
  hasLocalBearer,
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
 * Root QueryClient + platform managers. Must sit inside
 * `AuthSessionProvider` so 401 handling can clear a dead session.
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
  const authRef = useRef(auth);
  authRef.current = auth;
  const previousStatus = useRef(auth.status);
  const queryClientRef = useRef<ReturnType<
    typeof createShowzyQueryClient
  > | null>(null);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(
    () => auth.client?.getActiveCompany() ?? null,
  );

  const [queryClient] = useState(() => {
    const client = createShowzyQueryClient({
      onUnauthenticated: () => {
        const current = queryClientRef.current;
        if (current === null) {
          return;
        }
        handleUnauthenticatedQueryError({
          hadSession: hasLocalBearer(authRef.current.getAccessToken()),
          clearSession: () => {
            void authRef.current.clearDeadSession();
          },
          clearCache: () => {
            resetTenantQueryState({
              client: authRef.current.client,
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
    if (auth.client === null) {
      return;
    }
    return bindActiveCompanyQueryIsolation(auth.client, queryClient, {
      onCompanyId: setActiveCompanyId,
    });
  }, [auth.client, queryClient]);

  useEffect(() => {
    isolateCacheOnSessionLoss(previousStatus.current, auth.status, {
      client: auth.client,
      queryClient,
    });
    previousStatus.current = auth.status;
  }, [auth.status, auth.client, queryClient]);

  const setActiveCompany = useCallback(
    (companyId: string | null) => {
      auth.client?.setActiveCompany(companyId);
    },
    [auth.client],
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
