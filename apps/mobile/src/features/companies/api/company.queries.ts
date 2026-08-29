/**
 * `companies.get` read binding (SHO-226 / feature SHO-222). Keys follow
 * SHO-102: `[actionName, companyId, input]`. Input is always `{}` —
 * company id is never an access grant (ADR-0013).
 */
import type { ContractClient } from "../../../api/client";
import { contractQueryOptions } from "../../../api/query-options";

export const GET_COMPANY_ACTION = "companies.get";
export const GET_COMPANY_INPUT = {} as const;

type ShowzyClient = ContractClient;
export type GetCompanyOutput = Awaited<
  ReturnType<ShowzyClient["client"]["companies"]["get"]>
>;
export type CompanyLegalView = GetCompanyOutput["legal"];

export type CompanyGetTransport = {
  readonly client: {
    readonly companies: {
      readonly get: (
        input: typeof GET_COMPANY_INPUT,
      ) => Promise<GetCompanyOutput>;
    };
  };
};

export function bindGetCompany(client: CompanyGetTransport) {
  return (): Promise<GetCompanyOutput> => {
    return client.client.companies.get(GET_COMPANY_INPUT);
  };
}

export function getCompanyQueryOptions(args: {
  readonly client: CompanyGetTransport | null;
  readonly companyId: string | null;
  readonly getActiveCompany: () => string | null;
  readonly enabled?: boolean;
}) {
  const client = args.client;
  const fetchCompany = client === null ? null : bindGetCompany(client);
  return {
    ...contractQueryOptions({
      actionName: GET_COMPANY_ACTION,
      companyId: args.companyId,
      input: GET_COMPANY_INPUT,
      getActiveCompany: args.getActiveCompany,
      queryFn: () => {
        if (fetchCompany === null) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        return fetchCompany();
      },
    }),
    enabled:
      (args.enabled ?? true) && client !== null && args.companyId !== null,
  };
}
