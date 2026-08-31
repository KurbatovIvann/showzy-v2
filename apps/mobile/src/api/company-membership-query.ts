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
