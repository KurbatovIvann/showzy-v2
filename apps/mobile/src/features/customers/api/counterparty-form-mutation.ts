/**
 * Counterparty write binders for the form (SHO-196). One
 * `useContractMutation` attempt per write. UI drafts never go on the
 * wire: payloads are typed from `ContractClient` and parsed with the
 * action schemas.
 */
import {
  contractModules,
  wireErrorStatus,
  type MutationCallOptions,
} from "@showzy/contract";

import type {
  CounterpartyFormMutationResult,
  CounterpartyFormWrite,
  CreateCounterpartyPayload,
  UpdateCounterpartyPayload,
} from "../counterparties/counterparty-form-plan";

type CounterpartyWrites = {
  readonly createCounterparty: (
    input: CreateCounterpartyPayload,
    options: MutationCallOptions,
  ) => Promise<{ readonly id: string }>;
  readonly updateCounterparty: (
    input: UpdateCounterpartyPayload,
    options: MutationCallOptions,
  ) => Promise<{ readonly id: string }>;
};

export type CounterpartyFormTransport = {
  readonly client: {
    readonly customers: CounterpartyWrites;
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

function parseCreateCounterparty(
  input: CreateCounterpartyPayload,
): CreateCounterpartyPayload {
  const parsed =
    contractModules.customers.createCounterparty.input.safeParse(input);
  if (!parsed.success) {
    throw wireValidationFromIssues(parsed.error.issues);
  }
  return parsed.data;
}

function parseUpdateCounterparty(
  input: UpdateCounterpartyPayload,
): UpdateCounterpartyPayload {
  const parsed =
    contractModules.customers.updateCounterparty.input.safeParse(input);
  if (!parsed.success) {
    throw wireValidationFromIssues(parsed.error.issues);
  }
  return parsed.data;
}

export function bindCounterpartyFormMutate(client: CounterpartyFormTransport) {
  return (
    input: CounterpartyFormWrite,
    options: MutationCallOptions,
  ): Promise<CounterpartyFormMutationResult> => {
    try {
      switch (input.kind) {
        case "createCounterparty":
          return client.client.customers
            .createCounterparty(parseCreateCounterparty(input.input), options)
            .then((output) => ({ id: output.id }));
        case "updateCounterparty":
          return client.client.customers
            .updateCounterparty(parseUpdateCounterparty(input.input), options)
            .then((output) => ({ id: output.id }));
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        return Promise.reject(error);
      }
      return Promise.reject(
        new TypeError("counterparty form write parse failed"),
      );
    }
  };
}
