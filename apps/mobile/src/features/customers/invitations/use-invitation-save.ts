/**
 * Invitation create save hook (SHO-206). Wraps `runInvitationFormSave`
 * with `useContractMutation` and `invites.list` invalidation. The
 * one-time token/url stay in hook state, never in query keys.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { bindInviteFormMutate } from "../api/invite-form-mutation";
import { invalidateInvitesAfterWrite } from "../api/invite-revoke";
import type {
  InvitationFormDraft,
  InvitationFormFieldErrors,
} from "./invitation-form-draft";
import type { InvitationFormLoadState } from "./invitation-form-load";
import type {
  InvitationFormWrite,
  InviteCreateSecret,
} from "./invitation-form-plan";
import {
  NO_SAVE_FAILURE,
  runInvitationFormSave,
  type LastWriteFailure,
} from "./invitation-form-save";

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
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const [saveBusy, setSaveBusy] = useState(false);
  const [lastWrite, setLastWrite] = useState<InvitationFormWrite | null>(null);
  const saveBusyRef = useRef(false);
  const lastWriteRef = useRef<InvitationFormWrite | null>(null);
  const lastFailureRef = useRef<LastWriteFailure>(NO_SAVE_FAILURE);
  const mountedRef = useRef(true);
  const argsRef = useRef(args);
  argsRef.current = args;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const mutation = useContractMutation(
    (input: InvitationFormWrite, options) => {
      const current = apiRef.current;
      if (current === null) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return bindInviteFormMutate(current)(input, options);
    },
  );

  async function save(): Promise<void> {
    const current = argsRef.current;
    if (
      saveBusyRef.current ||
      apiClient === null ||
      current.loadKind !== "ready"
    ) {
      return;
    }
    saveBusyRef.current = true;
    setSaveBusy(true);
    try {
      await runInvitationFormSave({
        getDraft: current.getDraft,
        getCreated: () => current.createdRef.current,
        setCreated: (secret) => {
          current.createdRef.current = secret;
          current.setCreated(secret);
        },
        setOrigin: current.setOrigin,
        getLastWrite: () => lastWriteRef.current,
        setLastWrite: (write) => {
          lastWriteRef.current = write;
          setLastWrite(write);
        },
        getLastFailure: () => lastFailureRef.current,
        setLastFailure: (failure) => {
          lastFailureRef.current = failure;
        },
        setFieldErrors: current.setFieldErrors,
        submit: mutation.submit,
        retry: mutation.retry,
        resetMutation: mutation.reset,
        finish: async () => {
          await invalidateInvitesAfterWrite({
            queryClient,
            companyId: activeCompanyId,
          });
          await current.onSaved();
        },
      });
    } catch (error: unknown) {
      lastFailureRef.current = {
        kind: describeQueryFailure(error).kind,
        wire: describeWireError(error)?.code ?? null,
      };
    } finally {
      saveBusyRef.current = false;
      if (mountedRef.current) {
        setSaveBusy(false);
      }
    }
  }

  return {
    save,
    pending: saveBusy || mutation.isPending,
    lastWrite,
    mutationError: mutation.error,
    isMutationError: mutation.isError,
    resetMutation: () => {
      lastFailureRef.current = NO_SAVE_FAILURE;
      mutation.reset();
    },
  };
}
