/**
 * `customers.listGroups` read bindings (SHO-179). Keys follow SHO-102:
 * `[actionName, companyId, input]`.
 */
import type { ContractClient } from "../../../../api/client";
import { contractInfiniteQueryOptions } from "../../../../api/query-options";

export const LIST_GROUPS_ACTION = "customers.listGroups";

type ShowzyClient = ContractClient;
export type ListGroupsOutput = Awaited<
  ReturnType<ShowzyClient["client"]["customers"]["listGroups"]>
>;
export type GroupListItem = ListGroupsOutput["items"][number];

export type ListGroupsPageInput = {
  readonly search?: string;
  readonly limit?: number;
};

export function listGroupsInfiniteOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly input: ListGroupsPageInput;
  readonly getActiveCompany: () => string | null;
  readonly enabled?: boolean;
}) {
  const client = args.client;
  return {
    ...contractInfiniteQueryOptions({
      actionName: LIST_GROUPS_ACTION,
      companyId: args.companyId,
      input: args.input,
      getActiveCompany: args.getActiveCompany,
      queryFn: (cursor: string | null) => {
        if (client === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return client.client.customers.listGroups({
          ...args.input,
          ...(cursor === null ? {} : { cursor }),
        });
      },
      nextCursor: (page: ListGroupsOutput) => page.nextCursor,
    }),
    enabled:
      (args.enabled ?? true) && client !== null && args.companyId !== null,
  };
}
