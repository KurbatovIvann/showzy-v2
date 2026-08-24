import type { ContractClient } from "./client";
import {
  accountContractQueryKey,
  accountContractQueryOptions,
} from "./query-options";

export const LIST_MINE_ACTION = "companies.listMine";

export type CompanyMembership = {
  readonly membershipId: string;
  readonly role: "owner" | "admin" | "manager" | "employee";
  readonly company: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly prefix: string;
  };
};

export type ListMineOutput = {
  readonly memberships: readonly CompanyMembership[];
};

export function listMineQueryKey(sessionUserId: string) {
  return accountContractQueryKey(LIST_MINE_ACTION, sessionUserId, {});
}

export function listMineQueryOptions(
  client: ContractClient | null,
  sessionUserId: string,
) {
  return {
    ...accountContractQueryOptions({
      actionName: LIST_MINE_ACTION,
      sessionUserId,
      input: {},
      queryFn: () => {
        if (client === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return client.client.companies.listMine({});
      },
    }),
    enabled: client !== null,
  };
}
