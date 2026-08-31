/**
 * Root QueryClient provider skeleton (SHO-309). Session/company-aware
 * cache isolation joins in the auth + company-scope web tickets.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { createWebQueryClient } from "./query-client";

export function QueryProvider({ children }: { readonly children: ReactNode }) {
  const [queryClient] = useState(createWebQueryClient);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
