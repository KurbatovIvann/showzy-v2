/**
 * Dirty-leave for the order create form (SHO-213). Order-local. Do not
 * hoist to a generic navigator guard in this ticket.
 */
import { useNavigation, useRouter } from "expo-router";
import {
  usePreventRemove,
  type NavigationAction,
} from "expo-router/react-navigation";
import { useEffect, useRef, useState } from "react";

import { presentConfirmDialog } from "../../../components/ui/present-confirm-dialog";
import { waitForSheetDismiss } from "../../../components/ui/sheet-dismiss";
import type { OrdersCreateCopy } from "../../../i18n/orders";

export function useUnsavedOrderGuard(args: {
  readonly dirty: boolean;
  readonly pending: boolean;
  readonly copy: OrdersCreateCopy;
  readonly sheetOpen: boolean;
  readonly closeSheet: () => void;
}): {
  readonly requestLeave: () => void;
  readonly armLeave: () => void;
} {
  const { dirty, pending, copy, sheetOpen, closeSheet } = args;
  const router = useRouter();
  const navigation = useNavigation();
  const [leaveArmed, setLeaveArmed] = useState(false);
  const pendingLeaveActionRef = useRef<NavigationAction | null>(null);
  const leavePromptingRef = useRef(false);
  const sheetOpenRef = useRef(sheetOpen);
  sheetOpenRef.current = sheetOpen;

  usePreventRemove(dirty && !pending && !leaveArmed, ({ data }) => {
    pendingLeaveActionRef.current = data.action;
    void promptLeave();
  });

  useEffect(() => {
    if (!leaveArmed) {
      return;
    }
    const action = pendingLeaveActionRef.current;
    pendingLeaveActionRef.current = null;
    if (action !== null) {
      navigation.dispatch(action);
      return;
    }
    router.back();
  }, [leaveArmed, navigation, router]);

  async function promptLeave(): Promise<void> {
    if (leavePromptingRef.current) {
      return;
    }
    leavePromptingRef.current = true;
    const hadSheet = sheetOpenRef.current;
    closeSheet();
    if (hadSheet) {
      await waitForSheetDismiss();
    }
    const choice = await presentConfirmDialog({
      title: copy.leaveTitle,
      message: copy.leaveDescription,
      confirmLabel: copy.leaveConfirm,
      cancelLabel: copy.leaveContinue,
      tone: "danger",
    });
    leavePromptingRef.current = false;
    if (choice === "confirm") {
      setLeaveArmed(true);
      return;
    }
    pendingLeaveActionRef.current = null;
  }

  function requestLeave(): void {
    router.back();
  }

  return {
    requestLeave,
    armLeave: () => {
      setLeaveArmed(true);
    },
  };
}
