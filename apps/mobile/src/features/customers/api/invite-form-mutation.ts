/**
 * Staff invite create (SHO-206). `invites.create` is idempotent and
 * `requiresConfirmation: false` — no protocol challenge. Output includes
 * plaintext `token` and copyable `url` once. Callers must not put those
 * fields on React Query keys or the list cache.
 */
import {
  contractModules,
  wireErrorStatus,
  type MutationCallOptions,
} from "@showzy/contract";

import type {
  CreateInviteOutput,
  CreateInvitePayload,
  InvitationFormMutationResult,
  InvitationFormWrite,
} from "../invitations/invitation-form-plan";
import { secretFromCreateOutput } from "../invitations/invitation-form-plan";

type InviteWrites = {
  readonly create: (
    input: CreateInvitePayload,
    options: MutationCallOptions,
  ) => Promise<CreateInviteOutput>;
};

export type InviteFormTransport = {
  readonly client: {
    readonly invites: InviteWrites;
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

function parseCreateInvite(input: CreateInvitePayload): CreateInvitePayload {
  const parsed = contractModules.invites.create.input.safeParse(input);
  if (!parsed.success) {
    throw wireValidationFromIssues(parsed.error.issues);
  }
  return parsed.data;
}

export function bindInviteFormMutate(client: InviteFormTransport) {
  return (
    input: InvitationFormWrite,
    options: MutationCallOptions,
  ): Promise<InvitationFormMutationResult> => {
    try {
      return client.client.invites
        .create(parseCreateInvite(input.input), options)
        .then((output) => secretFromCreateOutput(output));
    } catch (error: unknown) {
      if (error instanceof Error) {
        return Promise.reject(error);
      }
      return Promise.reject(new TypeError("invite form write parse failed"));
    }
  };
}
