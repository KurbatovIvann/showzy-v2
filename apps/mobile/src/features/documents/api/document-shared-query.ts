/**
 * `documents.getShared` public-target read (SHO-238). Keys
 * `[actionName, null-company, { token }]`. Company id is never input.
 * Always pass `companyId: null` and `getActiveCompany: () => null` so a
 * signed-in staff selector cannot trip `StaleCompanyQueryError`.
 */
import type { ContractClient } from "../../../api/client";
import { contractQueryOptions } from "../../../api/query-options";

export const GET_SHARED_DOCUMENT_ACTION = "documents.getShared";

type ShowzyClient = ContractClient;
export type GetSharedDocumentOutput = Awaited<
  ReturnType<ShowzyClient["client"]["documents"]["getShared"]>
>;

export function getSharedDocumentQueryOptions(args: {
  readonly client: ContractClient | null;
  readonly token: string | null;
}) {
  const client = args.client;
  const token = args.token ?? "";
  return {
    ...contractQueryOptions({
      actionName: GET_SHARED_DOCUMENT_ACTION,
      companyId: null,
      input: { token },
      getActiveCompany: () => null,
      queryFn: () => {
        if (client === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return client.client.documents.getShared({ token });
      },
    }),
    enabled: client !== null && args.token !== null,
  };
}
