import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { createWebQueryClient } from "./query-client";

export function QueryProvider({ children }: { readonly children: ReactNode }) {
  const [queryClient] = useState(createWebQueryClient);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
