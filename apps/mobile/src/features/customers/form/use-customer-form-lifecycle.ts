/**
 * Archive / restore / delete on the client editor (SHO-180). Archive is
 * a UI confirm only. Delete is UI confirm then protocol confirmation.
 * After a successful write the form arms leave so the unsaved guard
 * pops back (same leave-arm as catalog save).
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
import { bindCustomerDeleteMutate } from "../api/customer-delete";
import {
  bindCustomerStatusMutate,
  invalidateCustomersAfterWrite,
  type CustomerStatusWrite,
} from "../api/customer-status";
import {
  customersWriteBanner,
  mapCustomersWriteFailure,
} from "../shared/mutation-failure";

export function useCustomerFormLifecycle(args: {
  readonly copy: CustomersCopy;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly customerId: string | null;
  readonly armLeave: () => void;
}): {
  readonly banner: string | null;
  readonly pending: boolean;
  readonly archive: () => Promise<void>;
  readonly restore: () => Promise<void>;
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

  const statusMutation = useContractMutation(
    (input: CustomerStatusWrite, options) => {
      const current = apiRef.current;
      if (current === null) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return bindCustomerStatusMutate(current)(input, options);
    },
  );
  const deleteMutation = useContractMutation(
    (input: { id: string }, options) => {
      const current = apiRef.current;
      if (current === null) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return bindCustomerDeleteMutate(current)(input, options);
    },
  );

  const statusFailure = statusMutation.isError
    ? describeQueryFailure(statusMutation.error).kind
    : null;
  const deleteFailure = deleteMutation.isError
    ? describeQueryFailure(deleteMutation.error).kind
    : null;
  const banner =
    customersWriteBanner(
      mapCustomersWriteFailure(deleteFailure),
      args.copy.mutation,
    ) ??
    customersWriteBanner(
      mapCustomersWriteFailure(statusFailure),
      args.copy.mutation,
    );

  async function afterWrite(): Promise<void> {
    await invalidateCustomersAfterWrite({
      queryClient,
      companyId: activeCompanyId,
    });
    statusMutation.reset();
    deleteMutation.reset();
    argsRef.current.armLeave();
  }

  return {
    banner,
    pending: statusMutation.isPending || deleteMutation.isPending,
    archive: async () => {
      const current = argsRef.current;
      const id = current.customerId;
      if (!current.canEdit || id === null || writeBusyRef.current) {
        return;
      }
      const choice = await presentConfirmDialog({
        title: current.copy.confirm.archiveTitle,
        message: current.copy.confirm.archiveDescription,
        confirmLabel: current.copy.confirm.archiveConfirm,
        cancelLabel: current.copy.confirm.cancel,
        tone: "default",
      });
      if (choice === "cancel") {
        return;
      }
      writeBusyRef.current = true;
      try {
        await statusMutation.submit({ kind: "archiveCustomer", id });
        await afterWrite();
      } catch {
        // Banner is derived from mutation.error.
      } finally {
        writeBusyRef.current = false;
      }
    },
    restore: async () => {
      const current = argsRef.current;
      const id = current.customerId;
      if (!current.canEdit || id === null || writeBusyRef.current) {
        return;
      }
      writeBusyRef.current = true;
      try {
        await statusMutation.submit({ kind: "restoreCustomer", id });
        await afterWrite();
      } catch {
        // Banner is derived from mutation.error.
      } finally {
        writeBusyRef.current = false;
      }
    },
    remove: async () => {
      const current = argsRef.current;
      const id = current.customerId;
      if (!current.canDelete || id === null || writeBusyRef.current) {
        return;
      }
      const choice = await presentConfirmDialog({
        title: current.copy.confirm.deleteTitle,
        message: current.copy.confirm.deleteDescription,
        confirmLabel: current.copy.confirm.deleteConfirm,
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
