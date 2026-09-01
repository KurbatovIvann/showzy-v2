/**
 * Contract read helpers. Copy this factory style in product screens —
 * do not put oRPC context in the query key.
 *
 * **Key:** `companyId` from `useActiveCompany()` (React state) so a
 * selector change re-renders. A one-shot `client.getActiveCompany()`
 * will not.
 *
 * **Assert:** `getActiveCompany` must be `() => client.getActiveCompany()`
 * (live `x-company-id`), never a render-closed React id. A closed
 * `() => activeCompanyId` makes before/after `assertCompanyStillActive`
 * a no-op while the RPC still follows the live header.
 *
 * Route `loader`s must pass the same `contractQueryOptions` /
 * `accountContractQueryOptions` object into `ensureQueryData` that the
 * page hook uses — one cache, no extra `/rpc` after hydrate.
 *
 * `assertCompanyStillActive` runs before and after `queryFn` so a
 * mid-flight company switch cannot commit another tenant's payload.
 * `StaleCompanyQueryError` is not retried — a retry can re-insert a
 * tenant key after `removeQueries`.
 */
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

/** Distinct key namespace when the client has no company selector. */
export const NULL_COMPANY_QUERY_SCOPE = "null-company";

export class StaleCompanyQueryError extends Error {
  constructor() {
    super("stale company query");
    this.name = "StaleCompanyQueryError";
  }
}

export type ContractQueryKey<TInput> = readonly [
  actionName: string,
  companyScope: string,
  input: TInput,
];

export type AccountContractQueryKey<TInput> = readonly [
  actionName: string,
  companyScope: typeof NULL_COMPANY_QUERY_SCOPE,
  sessionUserId: string,
  input: TInput,
];

export function contractQueryKey<TInput>(
  actionName: string,
  companyId: string | null,
  input: TInput,
): ContractQueryKey<TInput> {
  return [actionName, companyQueryScope(companyId), input];
}

export function companyQueryScope(companyId: string | null): string {
  return companyId === null ? NULL_COMPANY_QUERY_SCOPE : companyId;
}

export function accountContractQueryKey<TInput>(
  actionName: string,
  sessionUserId: string,
  input: TInput,
): AccountContractQueryKey<TInput> {
  return [actionName, NULL_COMPANY_QUERY_SCOPE, sessionUserId, input];
}

/**
 * Account reads are session-scoped and independent of the staff selector.
 * The server derives account authority from the authenticated session.
 */
export function accountContractQueryOptions<TInput, TOutput>(args: {
  readonly actionName: string;
  readonly sessionUserId: string;
  readonly input: TInput;
  readonly queryFn: () => Promise<TOutput>;
}) {
  return queryOptions({
    queryKey: accountContractQueryKey(
      args.actionName,
      args.sessionUserId,
      args.input,
    ),
    queryFn: args.queryFn,
  });
}

export function assertCompanyStillActive(
  getActiveCompany: () => string | null,
  companyId: string | null,
): void {
  if (companyQueryScope(getActiveCompany()) !== companyQueryScope(companyId)) {
    throw new StaleCompanyQueryError();
  }
}

/** Production default is 3; never retry a tenant-isolation abort. */
export function shouldRetryContractQuery(
  failureCount: number,
  error: unknown,
): boolean {
  if (error instanceof StaleCompanyQueryError) {
    return false;
  }
  return failureCount < 3;
}

export function contractQueryOptions<TInput, TOutput>(args: {
  readonly actionName: string;
  readonly companyId: string | null;
  readonly input: TInput;
  readonly queryFn: () => Promise<TOutput>;
  /**
   * Live selector (`() => client.getActiveCompany()`). Do not pass a
   * render-closed React id — mismatch must not write another tenant.
   */
  readonly getActiveCompany: () => string | null;
}) {
  return queryOptions({
    queryKey: contractQueryKey(args.actionName, args.companyId, args.input),
    queryFn: async () => {
      assertCompanyStillActive(args.getActiveCompany, args.companyId);
      const output = await args.queryFn();
      assertCompanyStillActive(args.getActiveCompany, args.companyId);
      return output;
    },
    retry: shouldRetryContractQuery,
  });
}

/**
 * Cursor-paginated contract reads. The key keeps the
 * `[actionName, companyScope, input]` shape — the cursor is the page
 * param, never part of the key — so tenant isolation and cache clearing
 * treat all pages as one entry.
 */
export function contractInfiniteQueryOptions<TInput, TPage>(args: {
  readonly actionName: string;
  readonly companyId: string | null;
  readonly input: TInput;
  readonly queryFn: (cursor: string | null) => Promise<TPage>;
  /**
   * Live selector (`() => client.getActiveCompany()`). Do not pass a
   * render-closed React id — mismatch must not write another tenant.
   */
  readonly getActiveCompany: () => string | null;
  /** `null` when the server reports no further page. */
  readonly nextCursor: (page: TPage) => string | null;
}) {
  return infiniteQueryOptions({
    queryKey: contractQueryKey(args.actionName, args.companyId, args.input),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      assertCompanyStillActive(args.getActiveCompany, args.companyId);
      const page = await args.queryFn(pageParam);
      assertCompanyStillActive(args.getActiveCompany, args.companyId);
      return page;
    },
    getNextPageParam: (lastPage) => args.nextCursor(lastPage),
    retry: shouldRetryContractQuery,
  });
}
