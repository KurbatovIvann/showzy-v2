/**
 * Customer write binders for the form (SHO-180). One `useContractMutation`
 * attempt per write. UI drafts never go on the wire: payloads are typed
 * from `ContractClient` and parsed with the action schemas.
 */
import {
  contractModules,
  wireErrorStatus,
  type MutationCallOptions,
} from "@showzy/contract";

import type {
  CreateCustomerPayload,
  CustomerFormMutationResult,
  CustomerFormWrite,
  UpdateCustomerPayload,
} from "../form/customer-form-plan";

type CustomerWrites = {
  readonly createCustomer: (
    input: CreateCustomerPayload,
    options: MutationCallOptions,
  ) => Promise<{ readonly id: string }>;
  readonly updateCustomer: (
    input: UpdateCustomerPayload,
    options: MutationCallOptions,
  ) => Promise<{ readonly id: string }>;
};

export type CustomerFormTransport = {
  readonly client: {
    readonly customers: CustomerWrites;
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

function parseCreateCustomer(
  input: CreateCustomerPayload,
): CreateCustomerPayload {
  const parsed = contractModules.customers.createCustomer.input.safeParse(
    input,
  );
  if (!parsed.success) {
    throw wireValidationFromIssues(parsed.error.issues);
  }
  return parsed.data;
}

function parseUpdateCustomer(
  input: UpdateCustomerPayload,
): UpdateCustomerPayload {
  const parsed = contractModules.customers.updateCustomer.input.safeParse(
    input,
  );
  if (!parsed.success) {
    throw wireValidationFromIssues(parsed.error.issues);
  }
  return parsed.data;
}

export function bindCustomerFormMutate(client: CustomerFormTransport) {
  return (
    input: CustomerFormWrite,
    options: MutationCallOptions,
  ): Promise<CustomerFormMutationResult> => {
    try {
      switch (input.kind) {
        case "createCustomer":
          return client.client.customers
            .createCustomer(parseCreateCustomer(input.input), options)
            .then((output) => ({ id: output.id }));
        case "updateCustomer":
          return client.client.customers
            .updateCustomer(parseUpdateCustomer(input.input), options)
            .then((output) => ({ id: output.id }));
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        return Promise.reject(error);
      }
      return Promise.reject(new TypeError("customer form write parse failed"));
    }
  };
}
