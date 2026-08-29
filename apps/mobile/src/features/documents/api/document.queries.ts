/**
 * `documents.list` read bindings for More → Документи (SHO-237). Keys
 * follow SHO-102: `[actionName, companyId, input]`; the page cursor is
 * the infinite query page param, never part of the key.
 */
import type { ContractClient } from "../../../api/client";
import { contractInfiniteQueryOptions } from "../../../api/query-options";

export const LIST_DOCUMENTS_ACTION = "documents.list";

type ShowzyClient = ContractClient;
export type ListDocumentsOutput = Awaited<
  ReturnType<ShowzyClient["client"]["documents"]["list"]>
>;
export type DocumentListItem = ListDocumentsOutput["items"][number];

export type DocumentsTypeFilter = "all" | "payment_invoice" | "delivery_note";

export type ListDocumentsPageInput = {
  readonly type: DocumentsTypeFilter;
  readonly orderId?: string;
};

export function listDocumentsWireInput(
  input: ListDocumentsPageInput,
  cursor: string | null,
): ListDocumentsPageInput & { readonly cursor?: string } {
  return {
    ...input,
    ...(cursor === null ? {} : { cursor }),
  };
}

export function listDocumentsInfiniteOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly input: ListDocumentsPageInput;
  readonly getActiveCompany: () => string | null;
}) {
  const client = args.client;
  return {
    ...contractInfiniteQueryOptions({
      actionName: LIST_DOCUMENTS_ACTION,
      companyId: args.companyId,
      input: args.input,
      getActiveCompany: args.getActiveCompany,
      queryFn: (cursor: string | null) => {
        if (client === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return client.client.documents.list(
          listDocumentsWireInput(args.input, cursor),
        );
      },
      nextCursor: (page: ListDocumentsOutput) => page.nextCursor,
    }),
    enabled: client !== null && args.companyId !== null,
  };
}
