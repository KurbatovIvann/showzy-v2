/**
 * Counterparty delete + edit navigation (SHO-195). Delete is UI confirm
 * then protocol confirmation. Permission is `customers:edit`.
 */
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure } from "../../../api/errors";
import { submitWithProtocolConfirmation } from "../../../api/protocol-confirm";
import { useActiveCompany } from "../../../api/query-provider";
import { presentConfirmDialog } from "../../../components/ui/present-confirm-dialog";
import type { CustomersCopy } from "../../../i18n/customers";
import { bindCounterpartyDeleteMutate } from "../api/counterparty-delete";
import { invalidateCustomersAfterWrite } from "../api/customer-status";
import { counterpartyEditorHref } from "../shared/customer-hrefs";
import {
  customersWriteBanner,
  mapCustomersWriteFailure,
} from "../shared/mutation-failure";

export function useCounterpartyWrites(args: {
  readonly copy: CustomersCopy;
  readonly canEdit: boolean;
}) {
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const router = useRouter();
  const writeBusyRef = useRef(false);

  const deleteMutation = useContractMutation(
    (input: { id: string }, options) => {
      const current = apiRef.current;
      if (current === null) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return bindCounterpartyDeleteMutate(current)(input, options);
    },
  );

  const banner = customersWriteBanner(
    mapCustomersWriteFailure(
      deleteMutation.isError
        ? describeQueryFailure(deleteMutation.error).kind
        : null,
    ),
    args.copy.mutation,
  );

  async function afterWrite(): Promise<void> {
    await invalidateCustomersAfterWrite({
      queryClient,
      companyId: activeCompanyId,
    });
    deleteMutation.reset();
  }

  return {
    banner,
    pending: deleteMutation.isPending,
    openEdit: (id: string) => {
      router.push(counterpartyEditorHref(id));
    },
    remove: async (id: string) => {
      if (!args.canEdit || writeBusyRef.current) {
        return;
      }
      const choice = await presentConfirmDialog({
        title: args.copy.confirm.deleteCounterpartyTitle,
        message: args.copy.confirm.deleteCounterpartyDescription,
        confirmLabel: args.copy.confirm.deleteCounterpartyConfirm,
        cancelLabel: args.copy.confirm.cancel,
        tone: "danger",
      });
      if (choice === "cancel") {
        return;
      }
      writeBusyRef.current = true;
      try {
        await submitWithProtocolConfirmation({
          submit: () => deleteMutation.submit({ id }),
          confirm: (challengeId) => deleteMutation.confirm(challengeId),
        });
        await afterWrite();
      } catch {
        // Banner is derived from mutation.error.
      } finally {
        writeBusyRef.current = false;
      }
    },
  };
}
