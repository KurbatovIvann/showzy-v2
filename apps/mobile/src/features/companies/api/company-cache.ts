/**
 * Shared companies query-key prefixes for post-write invalidation
 * (SHO-225). Hub and legal editor both read `companies.get`.
 */
import type { QueryClient } from "@tanstack/react-query";

import { companyQueryScope } from "../../../api/query-options";
import { GET_COMPANY_ACTION } from "./company.queries";

export function companyGetCacheKey(
  companyId: string,
): readonly [string, string] {
  return [GET_COMPANY_ACTION, companyQueryScope(companyId)];
}

export function companyWriteInvalidationKeys(
  companyId: string,
): readonly [readonly [string, string]] {
  return [companyGetCacheKey(companyId)];
}

export async function invalidateCompanyAfterWrite(args: {
  readonly queryClient: QueryClient;
  readonly companyId: string | null;
}): Promise<void> {
  if (args.companyId === null) {
    return;
  }
  await Promise.all(
    companyWriteInvalidationKeys(args.companyId).map((queryKey) =>
      args.queryClient.invalidateQueries({ queryKey }),
    ),
  );
}
