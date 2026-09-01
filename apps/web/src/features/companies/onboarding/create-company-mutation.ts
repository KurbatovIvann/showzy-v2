import type { MutationCallOptions } from "@showzy/contract";

import type { CompanyMembership } from "../api/list-mine";
import type { CreateCompanyInput } from "./create-company-form";

export type CreateCompanyTransport = {
  readonly client: {
    readonly companies: {
      readonly create: (
        input: CreateCompanyInput,
        options: MutationCallOptions,
      ) => Promise<CompanyMembership>;
    };
  };
};

export function bindCreateCompanyMutate(client: CreateCompanyTransport) {
  return (
    input: CreateCompanyInput,
    options: MutationCallOptions,
  ): Promise<CompanyMembership> =>
    client.client.companies.create(input, options);
}
