/**
 * Company-scoped `companies.get`. The **key** uses `companyId` from
 * React state (`useActiveCompany().activeCompanyId`). The **assert**
 * binds `() => client.getActiveCompany()` so a render-closed id cannot
 * skip isolation while `x-company-id` already moved. Loaders and hooks
 * must share this factory.
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
}) {
  return contractQueryOptions({
    actionName: GET_COMPANY_ACTION,
    companyId: args.companyId,
    input: GET_COMPANY_INPUT,
    getActiveCompany: () => args.client.getActiveCompany(),
    queryFn: () => args.client.client.companies.get(GET_COMPANY_INPUT),
  });
}
