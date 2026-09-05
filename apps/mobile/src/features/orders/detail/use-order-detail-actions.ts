/**
 * Confirm / start / complete / cancel writes + navigation (SHO-212 /
 * SHO-376). Each write mints a separate `useContractMutation` attempt so
 * a failed confirm does not retry as start. `requiresConfirmation` is
 * false on the contracts — the actions sheet is the cancel UX, not a
 * second protocol.
 */
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { useApiClient } from "../../../api/api-provider";
import { refreshListMineAfterAuthorizationDenied } from "../../../api/company-membership-query";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useAuthSession } from "../../../auth/session-provider";
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
  readonly startPending: boolean;
  readonly completePending: boolean;
  readonly cancelPending: boolean;
  readonly writePending: boolean;
  readonly goBack: () => void;
  readonly openActions: () => void;
  readonly closeActions: () => void;
  readonly confirm: () => void;
  readonly start: () => void;
  readonly complete: () => void;
  readonly cancel: () => void;
} {
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const router = useRouter();
  const writeBusyRef = useRef(false);
  const auth = useAuthSession();
  const sessionUserId = auth.session?.userId ?? null;

  const confirmMutation = useContractMutation(
    (input: OrderStatusWrite, options) => {
      const current = apiRef.current;
      if (current === null) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return bindOrderStatusMutate(current)(input, options);
    },
  );
  const startMutation = useContractMutation(
    (input: OrderStatusWrite, options) => {
      const current = apiRef.current;
      if (current === null) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return bindOrderStatusMutate(current)(input, options);
    },
  );
  const completeMutation = useContractMutation(
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
  const startFailure = startMutation.isError
    ? describeQueryFailure(startMutation.error).kind
    : null;
  const completeFailure = completeMutation.isError
    ? describeQueryFailure(completeMutation.error).kind
    : null;
  const cancelFailure = cancelMutation.isError
    ? describeQueryFailure(cancelMutation.error).kind
    : null;
  const banner =
    orderWriteBanner(mapOrderWriteFailure(cancelFailure), args.copy) ??
    orderWriteBanner(mapOrderWriteFailure(completeFailure), args.copy) ??
    orderWriteBanner(mapOrderWriteFailure(startFailure), args.copy) ??
    orderWriteBanner(mapOrderWriteFailure(confirmFailure), args.copy);

  function mutationFor(kind: OrderStatusWrite["kind"]) {
    switch (kind) {
      case "confirm":
        return confirmMutation;
      case "start":
        return startMutation;
      case "complete":
        return completeMutation;
      case "cancel":
        return cancelMutation;
    }
  }

  async function runWrite(kind: OrderStatusWrite["kind"]): Promise<void> {
    if (args.orderId === null || writeBusyRef.current) {
      return;
    }
    const mutation = mutationFor(kind);
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
      startMutation.reset();
      completeMutation.reset();
      cancelMutation.reset();
    } catch (error: unknown) {
      refreshListMineAfterAuthorizationDenied({
        queryClient,
        sessionUserId,
        error,
      });
      // Banner is derived from mutation.error.
    } finally {
      writeBusyRef.current = false;
    }
  }

  return {
    banner,
    confirmPending: confirmMutation.isPending,
    startPending: startMutation.isPending,
    completePending: completeMutation.isPending,
    cancelPending: cancelMutation.isPending,
    writePending:
      confirmMutation.isPending ||
      startMutation.isPending ||
      completeMutation.isPending ||
      cancelMutation.isPending,
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
    start: () => {
      void runWrite("start");
    },
    complete: () => {
      void runWrite("complete");
    },
    cancel: () => {
      args.dispatch({ type: "closeAll" });
      void runWrite("cancel");
    },
  };
}
