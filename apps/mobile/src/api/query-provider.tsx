import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useAuthSession } from "../auth/session-provider";
import {
  bindActiveCompanyQueryIsolation,
  clearCachedContractQueries,
  createShowzyQueryClient,
  handleUnauthenticatedQueryError,
} from "./query-client";
import { setupQueryPlatform } from "./query-platform";

/**
 * Root QueryClient + platform managers. Must sit inside
 * `AuthSessionProvider` so 401 handling can clear a dead session.
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

  const [queryClient] = useState(() => {
    const client = createShowzyQueryClient({
      onUnauthenticated: () => {
        const current = queryClientRef.current;
        if (current === null) {
          return;
        }
        handleUnauthenticatedQueryError({
          hadSession: authRef.current.session !== null,
          clearSession: () => {
            void authRef.current.clearDeadSession();
          },
          clearCache: () => {
            clearCachedContractQueries(current);
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
    return bindActiveCompanyQueryIsolation(auth.client, queryClient);
  }, [auth.client, queryClient]);

  useEffect(() => {
    if (
      previousStatus.current === "authenticated" &&
      auth.status === "anonymous"
    ) {
      clearCachedContractQueries(queryClient);
    }
    previousStatus.current = auth.status;
  }, [auth.status, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
