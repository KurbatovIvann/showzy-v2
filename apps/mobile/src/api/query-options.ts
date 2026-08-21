/**
 * Contract read helpers. Copy this factory style in product screens —
 * do not put oRPC context in the query key; include `companyId` here
 * from `useActiveCompany()` (React state), not a one-shot
 * `client.getActiveCompany()` that will not re-render.
 */
import { queryOptions } from "@tanstack/react-query";

/** Distinct key namespace when the client has no company selector. */
export const NULL_COMPANY_QUERY_SCOPE = "null-company";

export class StaleCompanyQueryError extends Error {
  constructor() {
    super("stale company query");
    this.name = "StaleCompanyQueryError";
  }
}

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
  return [actionName, companyQueryScope(companyId), input];
}

export function companyQueryScope(companyId: string | null): string {
  return companyId === null ? NULL_COMPANY_QUERY_SCOPE : companyId;
}

export function contractQueryOptions<TInput, TOutput>(args: {
  readonly actionName: string;
  readonly companyId: string | null;
  readonly input: TInput;
  readonly queryFn: () => Promise<TOutput>;
  /** Live selector; mismatch must not write another tenant under this key. */
  readonly getActiveCompany: () => string | null;
}) {
  return queryOptions({
    queryKey: contractQueryKey(args.actionName, args.companyId, args.input),
    queryFn: async () => {
      if (
        companyQueryScope(args.getActiveCompany()) !==
        companyQueryScope(args.companyId)
      ) {
        throw new StaleCompanyQueryError();
      }
      return args.queryFn();
    },
  });
}
