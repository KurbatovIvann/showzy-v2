import { queryOptions } from "@tanstack/react-query";

import type { ShowzyClient } from "./client";
import { contractQueryKey } from "./query-options";

export const LIST_MINE_ACTION = "companies.listMine";
export const LIST_MINE_INPUT = {} as const;

type ListMineClient = ShowzyClient;
export type ListMineOutput = Awaited<
  ReturnType<ListMineClient["client"]["companies"]["listMine"]>
>;
export type CompanyMembership = ListMineOutput["memberships"][number];

export function listMineQueryKey() {
  return contractQueryKey(LIST_MINE_ACTION, null, LIST_MINE_INPUT);
}

export function listMineQueryOptions(client: ShowzyClient, enabled: boolean) {
  return {
    ...queryOptions({
      queryKey: listMineQueryKey(),
      queryFn: () => client.client.companies.listMine(LIST_MINE_INPUT),
    }),
    enabled,
  };
}
