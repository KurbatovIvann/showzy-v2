/**
 * `docGeneration.listLayouts` read binding for the create form
 * (SHO-366). Keys follow SHO-102: `[actionName, companyId, input]`.
 * Action permission is `documents:view`; the create screen still gates
 * this query behind `documents:create` via `enabled`. Company id is
 * never action input.
 */
import type { ContractClient } from "../../../api/client";
import { requireReadyClient } from "../../../api/errors";
import { contractQueryOptions } from "../../../api/query-options";

export const LIST_LAYOUTS_ACTION = "docGeneration.listLayouts";

type ShowzyClient = ContractClient;
export type ListLayoutsOutput = Awaited<
  ReturnType<ShowzyClient["client"]["docGeneration"]["listLayouts"]>
>;
export type ListLayoutsInput = {
  readonly type: "payment_invoice" | "delivery_note";
};

export function listDocumentLayoutsQueryOptions(args: {
  readonly client: ContractClient | null;
  readonly companyId: string | null;
  readonly type: ListLayoutsInput["type"];
  readonly getActiveCompany: () => string | null;
  readonly enabled?: boolean;
}) {
  const client = args.client;
  const input: ListLayoutsInput = { type: args.type };
  return {
    ...contractQueryOptions({
      actionName: LIST_LAYOUTS_ACTION,
      companyId: args.companyId,
      input,
      getActiveCompany: args.getActiveCompany,
      queryFn: () =>
        requireReadyClient(client).client.docGeneration.listLayouts(input),
    }),
    enabled:
      (args.enabled ?? true) && client !== null && args.companyId !== null,
  };
}
