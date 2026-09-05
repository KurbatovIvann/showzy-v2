/**
 * Account-scoped `companies.listMine`. Route loaders and
 * `useListMine` share `listMineQueryOptions` so hydrate/navigation
 * reuse one cache entry.
 */
import { isWireError } from "@showzy/contract";
import type { QueryClient } from "@tanstack/react-query";

import type { ShowzyClient } from "../../../api/client";
import {
  accountContractQueryKey,
  accountContractQueryOptions,
} from "../../../api/query-options";

export const LIST_MINE_ACTION = "companies.listMine";
export const LIST_MINE_INPUT = {} as const;

type ListMineClient = ShowzyClient;
export type ListMineOutput = Awaited<
  ReturnType<ListMineClient["client"]["companies"]["listMine"]>
>;
export type CompanyMembership = ListMineOutput["memberships"][number];

export function listMineQueryKey(sessionUserId: string) {
  return accountContractQueryKey(
    LIST_MINE_ACTION,
    sessionUserId,
    LIST_MINE_INPUT,
  );
}

export function listMineQueryOptions(
  client: ShowzyClient,
  sessionUserId: string | null,
) {
  return {
    ...accountContractQueryOptions({
      actionName: LIST_MINE_ACTION,
      sessionUserId: sessionUserId ?? "",
      input: LIST_MINE_INPUT,
      queryFn: () => client.client.companies.listMine(LIST_MINE_INPUT),
    }),
    enabled: sessionUserId !== null,
  };
}

/**
 * Stale capability rows must not keep looking authorized after the server
 * denies a write. Account-scoped listMine is the source of the next
 * affordance pass.
 */
export function refreshListMineAfterAuthorizationDenied(args: {
  readonly queryClient: QueryClient;
  readonly sessionUserId: string | null;
  readonly error: unknown;
}): void {
  if (args.sessionUserId === null) {
    return;
  }
  if (!isWireError(args.error) || args.error.code !== "PERMISSION_DENIED") {
    return;
  }
  void args.queryClient.invalidateQueries({
    queryKey: listMineQueryKey(args.sessionUserId),
  });
}
