/**
 * `customers.getGroup` read binding (SHO-181). Keys follow SHO-102:
 * `[actionName, companyId, input]`.
 */
import type { ContractClient } from "../../../api/client";
import { contractQueryOptions } from "../../../api/query-options";

export const GET_GROUP_ACTION = "customers.getGroup";

type ShowzyClient = ContractClient;
export type GetGroupOutput = Awaited<
  ReturnType<ShowzyClient["client"]["customers"]["getGroup"]>
>;

export function getGroupQueryOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly groupId: string | null;
  readonly getActiveCompany: () => string | null;
}) {
  const client = args.client;
  const groupId = args.groupId ?? "";
  return {
    ...contractQueryOptions({
      actionName: GET_GROUP_ACTION,
      companyId: args.companyId,
      input: { id: groupId },
      getActiveCompany: args.getActiveCompany,
      queryFn: () => {
        if (client === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return client.client.customers.getGroup({ id: groupId });
      },
    }),
    enabled:
      client !== null && args.companyId !== null && args.groupId !== null,
  };
}
