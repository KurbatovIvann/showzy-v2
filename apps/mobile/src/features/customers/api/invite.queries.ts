/**
 * `invites.list` read bindings (SHO-205). Keys follow SHO-102:
 * `[actionName, companyId, input]`; the page cursor is the infinite
 * query page param, never part of the key. Output rows are the invite
 * view — no token, no hash, no copy URL.
 */
import type { ContractClient } from "../../../api/client";
import { contractInfiniteQueryOptions } from "../../../api/query-options";

export const LIST_INVITES_ACTION = "invites.list";

type ShowzyClient = ContractClient;
export type ListInvitesOutput = Awaited<
  ReturnType<ShowzyClient["client"]["invites"]["list"]>
>;
export type InviteListItem = ListInvitesOutput["items"][number];

export type ListInvitesPageInput = {
  readonly limit?: number;
};

export function listInvitesInfiniteOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly input: ListInvitesPageInput;
  readonly getActiveCompany: () => string | null;
  readonly enabled?: boolean;
}) {
  const client = args.client;
  return {
    ...contractInfiniteQueryOptions({
      actionName: LIST_INVITES_ACTION,
      companyId: args.companyId,
      input: args.input,
      getActiveCompany: args.getActiveCompany,
      queryFn: (cursor: string | null) => {
        if (client === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return client.client.invites.list({
          ...args.input,
          ...(cursor === null ? {} : { cursor }),
        });
      },
      nextCursor: (page: ListInvitesOutput) => page.nextCursor,
    }),
    enabled:
      (args.enabled ?? true) && client !== null && args.companyId !== null,
  };
}
