/**
 * `customers.listCounterparties` read bindings (SHO-195). Keys follow
 * SHO-102: `[actionName, companyId, input]`.
 */
import type { ContractClient } from "../../../api/client";
import { contractInfiniteQueryOptions } from "../../../api/query-options";

export const LIST_COUNTERPARTIES_ACTION = "customers.listCounterparties";

type ShowzyClient = ContractClient;
export type ListCounterpartiesOutput = Awaited<
  ReturnType<ShowzyClient["client"]["customers"]["listCounterparties"]>
>;
export type CounterpartyListItem = ListCounterpartiesOutput["items"][number];

export type ListCounterpartiesPageInput = {
  readonly search?: string;
  readonly limit?: number;
};

export function listCounterpartiesInfiniteOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly input: ListCounterpartiesPageInput;
  readonly getActiveCompany: () => string | null;
  readonly enabled?: boolean;
}) {
  const client = args.client;
  return {
    ...contractInfiniteQueryOptions({
      actionName: LIST_COUNTERPARTIES_ACTION,
      companyId: args.companyId,
      input: args.input,
      getActiveCompany: args.getActiveCompany,
      queryFn: (cursor: string | null) => {
        if (client === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return client.client.customers.listCounterparties({
          ...args.input,
          ...(cursor === null ? {} : { cursor }),
        });
      },
      nextCursor: (page: ListCounterpartiesOutput) => page.nextCursor,
    }),
    enabled:
      (args.enabled ?? true) && client !== null && args.companyId !== null,
  };
}
