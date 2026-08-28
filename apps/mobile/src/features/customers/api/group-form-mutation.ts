/**
 * Group write binders for the form (SHO-181). One `useContractMutation`
 * attempt per write. UI drafts never go on the wire: payloads are typed
 * from `ContractClient` and parsed with the action schemas.
 */
import {
  contractModules,
  wireErrorStatus,
  type MutationCallOptions,
} from "@showzy/contract";

import type {
  CreateGroupPayload,
  GroupFormMutationResult,
  GroupFormWrite,
  UpdateGroupPayload,
} from "../groups/group-form-plan";

type GroupWrites = {
  readonly createGroup: (
    input: CreateGroupPayload,
    options: MutationCallOptions,
  ) => Promise<{ readonly id: string }>;
  readonly updateGroup: (
    input: UpdateGroupPayload,
    options: MutationCallOptions,
  ) => Promise<{ readonly id: string }>;
};

export type GroupFormTransport = {
  readonly client: {
    readonly customers: GroupWrites;
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

function parseCreateGroup(input: CreateGroupPayload): CreateGroupPayload {
  const parsed = contractModules.customers.createGroup.input.safeParse(input);
  if (!parsed.success) {
    throw wireValidationFromIssues(parsed.error.issues);
  }
  return parsed.data;
}

function parseUpdateGroup(input: UpdateGroupPayload): UpdateGroupPayload {
  const parsed = contractModules.customers.updateGroup.input.safeParse(input);
  if (!parsed.success) {
    throw wireValidationFromIssues(parsed.error.issues);
  }
  return parsed.data;
}

export function bindGroupFormMutate(client: GroupFormTransport) {
  return (
    input: GroupFormWrite,
    options: MutationCallOptions,
  ): Promise<GroupFormMutationResult> => {
    try {
      switch (input.kind) {
        case "createGroup":
          return client.client.customers
            .createGroup(parseCreateGroup(input.input), options)
            .then((output) => ({ id: output.id }));
        case "updateGroup":
          return client.client.customers
            .updateGroup(parseUpdateGroup(input.input), options)
            .then((output) => ({ id: output.id }));
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        return Promise.reject(error);
      }
      return Promise.reject(new TypeError("group form write parse failed"));
    }
  };
}
