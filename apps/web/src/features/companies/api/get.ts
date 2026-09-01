/**
 * Company-scoped `companies.get`. Keys always include the live selector
 * (`contractQueryKey`); loaders and hooks must share this factory.
 */
import type { ShowzyClient } from "../../../api/client";
import {
  contractQueryKey,
  contractQueryOptions,
} from "../../../api/query-options";

export const GET_COMPANY_ACTION = "companies.get";
export const GET_COMPANY_INPUT = {} as const;

type GetCompanyClient = ShowzyClient;
export type CompanyGetOutput = Awaited<
  ReturnType<GetCompanyClient["client"]["companies"]["get"]>
>;

export function companyGetQueryKey(companyId: string) {
  return contractQueryKey(GET_COMPANY_ACTION, companyId, GET_COMPANY_INPUT);
}

export function companyGetQueryOptions(args: {
  readonly client: ShowzyClient;
  readonly companyId: string;
  readonly getActiveCompany: () => string | null;
}) {
  return contractQueryOptions({
    actionName: GET_COMPANY_ACTION,
    companyId: args.companyId,
    input: GET_COMPANY_INPUT,
    getActiveCompany: args.getActiveCompany,
    queryFn: () => args.client.client.companies.get(GET_COMPANY_INPUT),
  });
}
