/**
 * Company legal write binder (SHO-225). One `useContractMutation`
 * attempt per upsert. UI drafts never go on the wire: payloads are typed
 * from `ContractClient` and parsed with `companies.updateLegal`.
 */
import {
  contractModules,
  wireErrorStatus,
  type MutationCallOptions,
} from "@showzy/contract";

import type {
  CompanyLegalFormMutationResult,
  CompanyLegalFormWrite,
  UpdateLegalPayload,
} from "../form/company-legal-form-plan";

type CompanyWrites = {
  readonly updateLegal: (
    input: UpdateLegalPayload,
    options: MutationCallOptions,
  ) => Promise<{ readonly id: string }>;
};

export type CompanyLegalFormTransport = {
  readonly client: {
    readonly companies: CompanyWrites;
  };
};

function wireValidationFromIssues(
  issues: ReadonlyArray<{
    readonly code: string;
    readonly path: ReadonlyArray<PropertyKey>;
    readonly message: string;
  }>,
): Error {
  return Object.assign(new Error("Validation failed"), {
    code: "VALIDATION" as const,
    status: wireErrorStatus.VALIDATION,
    data: {
      issues: issues.map((issue) => ({
        code: issue.code,
        path: issue.path.filter(
          (part): part is string | number =>
            typeof part === "string" || typeof part === "number",
        ),
        message: issue.message,
      })),
    },
  });
}

function parseUpdateLegal(input: UpdateLegalPayload): UpdateLegalPayload {
  const parsed = contractModules.companies.updateLegal.input.safeParse(input);
  if (!parsed.success) {
    throw wireValidationFromIssues(parsed.error.issues);
  }
  return parsed.data;
}

export function bindCompanyLegalFormMutate(client: CompanyLegalFormTransport) {
  return (
    input: CompanyLegalFormWrite,
    options: MutationCallOptions,
  ): Promise<CompanyLegalFormMutationResult> => {
    try {
      return client.client.companies
        .updateLegal(parseUpdateLegal(input.input), options)
        .then((output) => ({ id: output.id }));
    } catch (error: unknown) {
      if (error instanceof Error) {
        return Promise.reject(error);
      }
      return Promise.reject(
        new TypeError("company legal form write parse failed"),
      );
    }
  };
}
