/**
 * Invite revoke from the list (SHO-205). UI confirm only — revoke has
 * no protocol challenge. Permission is `customers:invite`.
 */
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { presentConfirmDialog } from "../../../components/ui/present-confirm-dialog";
import type { CustomersCopy } from "../../../i18n/customers";
import {
  bindInviteRevokeMutate,
  invalidateInvitesAfterWrite,
} from "../api/invite-revoke";
import {
  customersWriteBanner,
  mapCustomersWriteFailure,
} from "../shared/mutation-failure";

export function useInviteWrites(args: {
  readonly copy: CustomersCopy;
  readonly canInvite: boolean;
}) {
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const writeBusyRef = useRef(false);

  const revokeMutation = useContractMutation(
    (input: { id: string }, options) => {
      const current = apiRef.current;
      if (current === null) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return bindInviteRevokeMutate(current)(input, options);
    },
  );

  const banner = customersWriteBanner(
    mapCustomersWriteFailure(
      revokeMutation.isError
        ? describeQueryFailure(revokeMutation.error).kind
        : null,
    ),
    args.copy.mutation,
  );

  async function afterWrite(): Promise<void> {
    await invalidateInvitesAfterWrite({
      queryClient,
      companyId: activeCompanyId,
    });
    revokeMutation.reset();
  }

  return {
    banner,
    pending: revokeMutation.isPending,
    revoke: async (id: string) => {
      if (!args.canInvite || writeBusyRef.current) {
        return;
      }
      const choice = await presentConfirmDialog({
        title: args.copy.confirm.revokeInviteTitle,
        message: args.copy.confirm.revokeInviteDescription,
        confirmLabel: args.copy.confirm.revokeInviteConfirm,
        cancelLabel: args.copy.confirm.cancel,
        tone: "danger",
      });
      if (choice === "cancel") {
        return;
      }
      writeBusyRef.current = true;
      try {
        await revokeMutation.submit({ id });
        await afterWrite();
      } catch {
        // Banner is derived from mutation.error.
      } finally {
        writeBusyRef.current = false;
      }
    },
  };
}
