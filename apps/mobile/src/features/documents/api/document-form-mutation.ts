/**
 * `documents.createFromOrder` write binder (SHO-238). One
 * `useContractMutation` attempt per submit. UI drafts never go on the
 * wire: payloads are typed from `ContractClient` and parsed with the
 * action schema.
 */
import {
  contractModules,
  wireErrorStatus,
  type MutationCallOptions,
} from "@showzy/contract";

import type {
  CreateFromOrderPayload,
  CreateFromOrderResult,
  DocumentFormWrite,
} from "../form/document-form-plan";

export type DocumentFormTransport = {
  readonly client: {
    readonly documents: {
      readonly createFromOrder: (
        input: CreateFromOrderPayload,
        options: MutationCallOptions,
      ) => Promise<CreateFromOrderResult>;
    };
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

function parseCreateFromOrder(
  input: CreateFromOrderPayload,
): CreateFromOrderPayload {
  const parsed =
    contractModules.documents.createFromOrder.input.safeParse(input);
  if (!parsed.success) {
    throw wireValidationFromIssues(parsed.error.issues);
  }
  return parsed.data;
}

export function bindDocumentFormMutate(client: DocumentFormTransport) {
  return (
    input: DocumentFormWrite,
    options: MutationCallOptions,
  ): Promise<CreateFromOrderResult> => {
    try {
      return client.client.documents.createFromOrder(
        parseCreateFromOrder(input.input),
        options,
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        return Promise.reject(error);
      }
      return Promise.reject(new TypeError("document form write parse failed"));
    }
  };
}
