/**
 * Confirm / cancel writes + navigation (SHO-212). Confirm and cancel
 * mint separate `useContractMutation` attempts so a failed confirm does
 * not retry as cancel. `requiresConfirmation` is false on both contracts
 * — the actions sheet is the cancel UX, not a second protocol.
 */
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import type { OrdersDetailCopy } from "../../../i18n/orders";
import {
  bindOrderStatusMutate,
  invalidateOrdersAfterStatusWrite,
  type OrderStatusWrite,
} from "../api/order-status-write";
import {
  mapOrderWriteFailure,
  orderWriteBanner,
  planOrderStatusWrite,
} from "./order-detail-model";
import type { OrderDetailSheetAction } from "./order-detail.reducer";

export function useOrderDetailActions(args: {
  readonly orderId: string | null;
  readonly copy: OrdersDetailCopy;
  readonly dispatch: (action: OrderDetailSheetAction) => void;
}): {
  readonly banner: string | null;
  readonly confirmPending: boolean;
  readonly cancelPending: boolean;
  readonly writePending: boolean;
  readonly goBack: () => void;
  readonly openActions: () => void;
  readonly closeActions: () => void;
  readonly confirm: () => void;
  readonly cancel: () => void;
} {
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const router = useRouter();
  const writeBusyRef = useRef(false);

  const confirmMutation = useContractMutation(
    (input: OrderStatusWrite, options) => {
      const current = apiRef.current;
      if (current === null) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return bindOrderStatusMutate(current)(input, options);
    },
  );
  const cancelMutation = useContractMutation(
    (input: OrderStatusWrite, options) => {
      const current = apiRef.current;
      if (current === null) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return bindOrderStatusMutate(current)(input, options);
    },
  );

  const confirmFailure = confirmMutation.isError
    ? describeQueryFailure(confirmMutation.error).kind
    : null;
  const cancelFailure = cancelMutation.isError
    ? describeQueryFailure(cancelMutation.error).kind
    : null;
  const banner =
    orderWriteBanner(mapOrderWriteFailure(cancelFailure), args.copy) ??
    orderWriteBanner(mapOrderWriteFailure(confirmFailure), args.copy);

  async function runWrite(kind: OrderStatusWrite["kind"]): Promise<void> {
    if (args.orderId === null || writeBusyRef.current) {
      return;
    }
    const mutation = kind === "confirm" ? confirmMutation : cancelMutation;
    if (mutation.isPending) {
      return;
    }
    writeBusyRef.current = true;
    try {
      if (planOrderStatusWrite(mutation.isError) === "retry") {
        await mutation.retry();
      } else {
        await mutation.submit({ kind, orderId: args.orderId });
      }
      await invalidateOrdersAfterStatusWrite({
        queryClient,
        companyId: activeCompanyId,
      });
      args.dispatch({ type: "closeAll" });
      confirmMutation.reset();
      cancelMutation.reset();
    } catch {
      // Banner is derived from mutation.error.
    } finally {
      writeBusyRef.current = false;
    }
  }

  return {
    banner,
    confirmPending: confirmMutation.isPending,
    cancelPending: cancelMutation.isPending,
    writePending: confirmMutation.isPending || cancelMutation.isPending,
    goBack: () => {
      router.back();
    },
    openActions: () => {
      args.dispatch({ type: "openActions" });
    },
    closeActions: () => {
      args.dispatch({ type: "closeAll" });
    },
    confirm: () => {
      void runWrite("confirm");
    },
    cancel: () => {
      args.dispatch({ type: "closeAll" });
      void runWrite("cancel");
    },
  };
}
