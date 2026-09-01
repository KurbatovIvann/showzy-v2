/**
 * Group delete + edit navigation (SHO-179 / SHO-307). Delete is UI
 * confirm then protocol confirmation. Callbacks are ref-stable so pane
 * `useCallback([model.remove])` and row `memo` bail.
 */
import { useCallback, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure } from "../../../api/errors";
import { submitWithProtocolConfirmation } from "../../../api/protocol-confirm";
import { useActiveCompany } from "../../../api/query-provider";
import type { CustomersCopy } from "../../../i18n/customers";
import type { Locale } from "../../../i18n/locale";
import { invalidateCustomersAfterWrite } from "../api/customer-status";
import { bindGroupDeleteMutate } from "../api/group-delete";
import { runConfirmedWrite } from "../shared/confirmed-write";
import { groupEditorHref } from "../shared/customer-hrefs";
import {
  customersWriteBanner,
  mapCustomersWriteFailure,
} from "../shared/mutation-failure";
import { deleteGroupConfirmMessage } from "./groups-list.presenter";

export function useGroupWrites(args: {
  readonly copy: CustomersCopy;
  readonly locale: Locale;
  readonly canEdit: boolean;
}) {
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const router = useRouter();
  const writeBusyRef = useRef(false);
  const argsRef = useRef(args);
  argsRef.current = args;
  const companyIdRef = useRef(activeCompanyId);
  companyIdRef.current = activeCompanyId;
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;
  const routerRef = useRef(router);
  routerRef.current = router;

  const deleteMutation = useContractMutation(
    (input: { id: string }, options) => {
      const current = apiRef.current;
      if (current === null) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return bindGroupDeleteMutate(current)(input, options);
    },
  );
  const deleteMutationRef = useRef(deleteMutation);
  deleteMutationRef.current = deleteMutation;

  const banner = customersWriteBanner(
    mapCustomersWriteFailure(
      deleteMutation.isError
        ? describeQueryFailure(deleteMutation.error).kind
        : null,
    ),
    args.copy.mutation,
  );

  const afterWrite = useCallback(async (): Promise<void> => {
    await invalidateCustomersAfterWrite({
      queryClient: queryClientRef.current,
      companyId: companyIdRef.current,
    });
    deleteMutationRef.current.reset();
  }, []);

  const openEdit = useCallback((id: string) => {
    routerRef.current.push(groupEditorHref(id));
  }, []);

  const remove = useCallback(
    async (id: string, memberCount: number) => {
      const current = argsRef.current;
      const message = deleteGroupConfirmMessage(
        memberCount,
        current.locale,
        current.copy.confirm,
      );
      await runConfirmedWrite({
        busyRef: writeBusyRef,
        allowed: current.canEdit,
        confirm: {
          title: current.copy.confirm.deleteGroupTitle,
          message,
          confirmLabel: current.copy.confirm.deleteGroupConfirm,
          cancelLabel: current.copy.confirm.cancel,
          tone: "danger",
        },
        run: async () => {
          await submitWithProtocolConfirmation({
            submit: () => deleteMutationRef.current.submit({ id }),
            confirm: (challengeId) =>
              deleteMutationRef.current.confirm(challengeId),
          });
          await afterWrite();
        },
      });
    },
    [afterWrite],
  );

  return useMemo(
    () => ({
      banner,
      pending: deleteMutation.isPending,
      openEdit,
      remove,
    }),
    [banner, deleteMutation.isPending, openEdit, remove],
  );
}
