import type { MutationCallOptions } from "@showzy/contract";

import type {
  CompanyMembership,
  CreateCompanyInput,
} from "./create-company-form";

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
