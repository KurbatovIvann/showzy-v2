import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ApiProvider } from "./api/api-provider";
import type { ShowzyClient } from "./api/client";
import { QueryProvider, QueryRuntimeProvider } from "./api/query-provider";
import { SessionProvider } from "./auth/session-provider";
import type { ShowzyAuthClient } from "./auth/client";

export function AppProviders({
  authClient,
  children,
  client,
  queryClient,
}: {
  readonly authClient: ShowzyAuthClient;
  readonly children: ReactNode;
  readonly client?: ShowzyClient;
  readonly queryClient?: QueryClient;
}) {
  return (
    <QueryProvider {...(queryClient === undefined ? {} : { queryClient })}>
      <SessionProvider authClient={authClient}>
        <ApiProvider {...(client === undefined ? {} : { client })}>
          <QueryRuntimeProvider>{children}</QueryRuntimeProvider>
        </ApiProvider>
      </SessionProvider>
    </QueryProvider>
  );
}
