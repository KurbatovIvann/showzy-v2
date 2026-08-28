/**
 * `customers.getCounterparty` read binding (SHO-196). Keys follow
 * SHO-102: `[actionName, companyId, input]`.
 */
import type { ContractClient } from "../../../api/client";
import { contractQueryOptions } from "../../../api/query-options";

export const GET_COUNTERPARTY_ACTION = "customers.getCounterparty";

type ShowzyClient = ContractClient;
export type GetCounterpartyOutput = Awaited<
  ReturnType<ShowzyClient["client"]["customers"]["getCounterparty"]>
>;

export function getCounterpartyQueryOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly counterpartyId: string | null;
  readonly getActiveCompany: () => string | null;
}) {
  const client = args.client;
  const counterpartyId = args.counterpartyId ?? "";
  return {
    ...contractQueryOptions({
      actionName: GET_COUNTERPARTY_ACTION,
      companyId: args.companyId,
      input: { id: counterpartyId },
      getActiveCompany: args.getActiveCompany,
      queryFn: () => {
        if (client === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return client.client.customers.getCounterparty({
          id: counterpartyId,
        });
      },
    }),
    enabled:
      client !== null &&
      args.companyId !== null &&
      args.counterpartyId !== null,
  };
}
