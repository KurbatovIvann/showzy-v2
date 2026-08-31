import type { ReactNode } from "react";

import { ApiProvider } from "./api/api-provider";
import { QueryProvider } from "./api/query-provider";
import { SessionProvider } from "./auth/session-provider";
import type { ShowzyAuthClient } from "./auth/client";

export function AppProviders({
  authClient,
  children,
}: {
  readonly authClient: ShowzyAuthClient;
  readonly children: ReactNode;
}) {
  return (
    <QueryProvider>
      <SessionProvider authClient={authClient}>
        <ApiProvider>{children}</ApiProvider>
      </SessionProvider>
    </QueryProvider>
  );
}
