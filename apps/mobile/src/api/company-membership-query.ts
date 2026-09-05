import { isWireError } from "@showzy/contract";
import type { QueryClient } from "@tanstack/react-query";

import type { ContractClient } from "./client";
import { requireReadyClient } from "./errors";
import {
  accountContractQueryKey,
  accountContractQueryOptions,
} from "./query-options";

export const LIST_MINE_ACTION = "companies.listMine";

type ShowzyClient = ContractClient;
export type ListMineOutput = Awaited<
  ReturnType<ShowzyClient["client"]["companies"]["listMine"]>
>;
export type CompanyMembership = ListMineOutput["memberships"][number];

export function listMineQueryKey(sessionUserId: string) {
  return accountContractQueryKey(LIST_MINE_ACTION, sessionUserId, {});
}

export function listMineQueryOptions(
  client: ContractClient | null,
  sessionUserId: string | null,
) {
  const querySession = sessionUserId ?? "missing-session";
  return {
    ...accountContractQueryOptions({
      actionName: LIST_MINE_ACTION,
      sessionUserId: querySession,
      input: {},
      queryFn: () => requireReadyClient(client).client.companies.listMine({}),
    }),
    enabled: client !== null && sessionUserId !== null,
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
