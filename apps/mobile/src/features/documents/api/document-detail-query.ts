/**
 * `documents.get` read binding for the options sheet / open-PDF path
 * (SHO-237). Keys follow SHO-102. Do not call this per list row — the
 * list contract has no `generation` field.
 */
import type { ContractClient } from "../../../api/client";
import { contractQueryOptions } from "../../../api/query-options";

export const GET_DOCUMENT_ACTION = "documents.get";

type ShowzyClient = ContractClient;
export type GetDocumentOutput = Awaited<
  ReturnType<ShowzyClient["client"]["documents"]["get"]>
>;

export function getDocumentQueryOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly documentId: string | null;
  readonly getActiveCompany: () => string | null;
}) {
  const client = args.client;
  const documentId = args.documentId ?? "";
  return {
    ...contractQueryOptions({
      actionName: GET_DOCUMENT_ACTION,
      companyId: args.companyId,
      input: { documentId },
      getActiveCompany: args.getActiveCompany,
      queryFn: () => {
        if (client === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return client.client.documents.get({ documentId });
      },
    }),
    enabled:
      client !== null && args.companyId !== null && args.documentId !== null,
  };
}
