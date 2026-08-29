/**
 * Client archive / restore / delete + navigation (SHO-179). Archive is a
 * UI confirm only. Delete is UI confirm then protocol confirmation.
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
import { bindCustomerDeleteMutate } from "../api/customer-delete";
import {
  bindCustomerStatusMutate,
  invalidateCustomersAfterWrite,
  type CustomerStatusWrite,
} from "../api/customer-status";
import { customerEditorHref } from "../shared/customer-hrefs";
import {
  customersWriteBanner,
  mapCustomersWriteFailure,
} from "../shared/mutation-failure";

export function useClientWrites(args: {
  readonly copy: CustomersCopy;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
}) {
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const router = useRouter();
  const writeBusyRef = useRef(false);

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
  }

  return {
    banner,
    pending: statusMutation.isPending || deleteMutation.isPending,
    openEdit: (id: string) => {
      router.push(customerEditorHref(id));
    },
    archive: async (id: string) => {
      if (!args.canEdit || writeBusyRef.current) {
        return;
      }
      const choice = await presentConfirmDialog({
        title: args.copy.confirm.archiveTitle,
        message: args.copy.confirm.archiveDescription,
        confirmLabel: args.copy.confirm.archiveConfirm,
        cancelLabel: args.copy.confirm.cancel,
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
    restore: async (id: string) => {
      if (!args.canEdit || writeBusyRef.current) {
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
    remove: async (id: string) => {
      if (!args.canDelete || writeBusyRef.current) {
        return;
      }
      const choice = await presentConfirmDialog({
        title: args.copy.confirm.deleteTitle,
        message: args.copy.confirm.deleteDescription,
        confirmLabel: args.copy.confirm.deleteConfirm,
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
