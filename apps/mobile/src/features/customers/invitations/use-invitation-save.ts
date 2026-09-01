/**
 * Invitation create save hook (SHO-206 / SHO-307). Single `invites.create`
 * write — form-kit `useFormSave` / `runFormSave` fits. The one-time
 * token/url stay in hook state, never in query keys.
 */
import { useQueryClient } from "@tanstack/react-query";
import type { MutationCallOptions } from "@showzy/contract";

import type { ContractClient } from "../../../api/client";
import { useActiveCompany } from "../../../api/query-provider";
import { useFormSave } from "../../../components/form-kit";
import { bindInviteFormMutate } from "../api/invite-form-mutation";
import { invalidateInvitesAfterWrite } from "../api/invite-revoke";
import type {
  InvitationFormDraft,
  InvitationFormFieldErrors,
} from "./invitation-form-draft";
import type { InvitationFormLoadState } from "./invitation-form-load";
import {
  parseThenPlanInvitationFormSave,
  type InvitationFormWrite,
  type InviteCreateSecret,
} from "./invitation-form-plan";

function bindInviteSave(
  client: ContractClient,
): (
  input: InvitationFormWrite,
  options: MutationCallOptions,
) => Promise<InviteCreateSecret> {
  return bindInviteFormMutate(client);
}

export function useInvitationSave(args: {
  readonly loadKind: InvitationFormLoadState["kind"];
  readonly getDraft: () => InvitationFormDraft;
  readonly setOrigin: (draft: InvitationFormDraft) => void;
  readonly createdRef: { current: InviteCreateSecret | null };
  readonly setCreated: (secret: InviteCreateSecret) => void;
  readonly onSaved: () => Promise<void>;
  readonly setFieldErrors: (errors: InvitationFormFieldErrors) => void;
}): {
  readonly save: () => Promise<void>;
  readonly pending: boolean;
  readonly lastWrite: InvitationFormWrite | null;
  readonly mutationError: unknown;
  readonly isMutationError: boolean;
  readonly resetMutation: () => void;
} {
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();

  return useFormSave<
    InvitationFormDraft,
    InvitationFormWrite,
    InviteCreateSecret,
    InvitationFormFieldErrors
  >({
    bindMutate: bindInviteSave,
    invalidate: () =>
      invalidateInvitesAfterWrite({
        queryClient,
        companyId: activeCompanyId,
      }),
    ready: args.loadKind === "ready",
    getDraft: args.getDraft,
    setOrigin: args.setOrigin,
    setFieldErrors: args.setFieldErrors,
    plan: ({ lastWrite, lastFailure }) =>
      parseThenPlanInvitationFormSave({
        draft: args.getDraft(),
        created: args.createdRef.current,
        lastWrite,
        lastFailureKind: lastFailure.kind,
        lastWireCode: lastFailure.wire,
      }),
    applySuccess: ({ result }) => {
      args.createdRef.current = result;
      args.setCreated(result);
    },
    onSaved: () => args.onSaved(),
  });
}
