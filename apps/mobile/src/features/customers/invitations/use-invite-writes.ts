/**
 * Invite revoke from the list (SHO-205 / SHO-307). UI confirm only —
 * revoke has no protocol challenge. Permission is `customers:invite`.
 * Callbacks are ref-stable so pane `useCallback([model.revoke])` bails.
 */
import { useCallback, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import type { CustomersCopy } from "../../../i18n/customers";
import {
  bindInviteRevokeMutate,
  invalidateInvitesAfterWrite,
} from "../api/invite-revoke";
import { runConfirmedWrite } from "../shared/confirmed-write";
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
  const argsRef = useRef(args);
  argsRef.current = args;
  const companyIdRef = useRef(activeCompanyId);
  companyIdRef.current = activeCompanyId;
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const revokeMutation = useContractMutation(
    (input: { id: string }, options) => {
      const current = apiRef.current;
      if (current === null) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return bindInviteRevokeMutate(current)(input, options);
    },
  );
  const revokeMutationRef = useRef(revokeMutation);
  revokeMutationRef.current = revokeMutation;

  const banner = customersWriteBanner(
    mapCustomersWriteFailure(
      revokeMutation.isError
        ? describeQueryFailure(revokeMutation.error).kind
        : null,
    ),
    args.copy.mutation,
  );

  const afterWrite = useCallback(async (): Promise<void> => {
    await invalidateInvitesAfterWrite({
      queryClient: queryClientRef.current,
      companyId: companyIdRef.current,
    });
    revokeMutationRef.current.reset();
  }, []);

  const revoke = useCallback(
    async (id: string) => {
      const current = argsRef.current;
      await runConfirmedWrite({
        busyRef: writeBusyRef,
        allowed: current.canInvite,
        confirm: {
          title: current.copy.confirm.revokeInviteTitle,
          message: current.copy.confirm.revokeInviteDescription,
          confirmLabel: current.copy.confirm.revokeInviteConfirm,
          cancelLabel: current.copy.confirm.cancel,
          tone: "danger",
        },
        run: async () => {
          await revokeMutationRef.current.submit({ id });
          await afterWrite();
        },
      });
    },
    [afterWrite],
  );

  return useMemo(
    () => ({
      banner,
      pending: revokeMutation.isPending,
      revoke,
    }),
    [banner, revokeMutation.isPending, revoke],
  );
}
