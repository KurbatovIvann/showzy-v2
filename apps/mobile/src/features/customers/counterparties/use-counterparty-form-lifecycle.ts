/**
 * Delete on the counterparty editor (SHO-196). Permission is
 * `customers:edit` (not `customers:delete`). UI confirm then protocol
 * confirmation. After a successful write the form arms leave.
 */
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure } from "../../../api/errors";
import { submitWithProtocolConfirmation } from "../../../api/protocol-confirm";
import { useActiveCompany } from "../../../api/query-provider";
import { presentConfirmDialog } from "../../../components/ui/present-confirm-dialog";
import type { CustomersCopy } from "../../../i18n/customers";
import { bindCounterpartyDeleteMutate } from "../api/counterparty-delete";
import { invalidateCustomersAfterWrite } from "../api/customer-status";
import {
  customersWriteBanner,
  mapCustomersWriteFailure,
} from "../shared/mutation-failure";

export function useCounterpartyFormLifecycle(args: {
  readonly copy: CustomersCopy;
  readonly canEdit: boolean;
  readonly counterpartyId: string | null;
  readonly armLeave: () => void;
}): {
  readonly banner: string | null;
  readonly pending: boolean;
  readonly remove: () => Promise<void>;
} {
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const writeBusyRef = useRef(false);
  const argsRef = useRef(args);
  argsRef.current = args;

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
    argsRef.current.armLeave();
  }

  return {
    banner,
    pending: deleteMutation.isPending,
    remove: async () => {
      const current = argsRef.current;
      const id = current.counterpartyId;
      if (!current.canEdit || id === null || writeBusyRef.current) {
        return;
      }
      const choice = await presentConfirmDialog({
        title: current.copy.confirm.deleteCounterpartyTitle,
        message: current.copy.confirm.deleteCounterpartyDescription,
        confirmLabel: current.copy.confirm.deleteCounterpartyConfirm,
        cancelLabel: current.copy.confirm.cancel,
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
