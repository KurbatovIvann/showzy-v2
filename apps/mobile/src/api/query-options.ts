/**
 * Contract read helpers. Copy this factory style in product screens —
 * do not put oRPC context in the query key; include `companyId` here.
 */
import { queryOptions } from "@tanstack/react-query";

/** Distinct key namespace when the client has no company selector. */
export const NULL_COMPANY_QUERY_SCOPE = "null-company";

export type ContractQueryKey<TInput> = readonly [
  actionName: string,
  companyScope: string,
  input: TInput,
];

export function contractQueryKey<TInput>(
  actionName: string,
  companyId: string | null,
  input: TInput,
): ContractQueryKey<TInput> {
  return [
    actionName,
    companyId === null ? NULL_COMPANY_QUERY_SCOPE : companyId,
    input,
  ];
}

export function contractQueryOptions<TInput, TOutput>(args: {
  readonly actionName: string;
  readonly companyId: string | null;
  readonly input: TInput;
  readonly queryFn: () => Promise<TOutput>;
}) {
  return queryOptions({
    queryKey: contractQueryKey(args.actionName, args.companyId, args.input),
    queryFn: args.queryFn,
  });
}
