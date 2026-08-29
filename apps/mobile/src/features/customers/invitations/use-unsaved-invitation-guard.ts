/**
 * Dirty-leave for the invitation create form (SHO-206). Invitation-local:
 * dirty is RHF only. After a successful create, dirty is already false
 * (`created !== null`). `armLeave` only dispatches a pending back
 * action so a confirmed dirty-leave does not prompt again — never
 * auto-`router.back()` with none.
 */
import { useNavigation, useRouter } from "expo-router";
import {
  usePreventRemove,
  type NavigationAction,
} from "expo-router/react-navigation";
import { useEffect, useRef, useState } from "react";

import { presentConfirmDialog } from "../../../components/ui/present-confirm-dialog";
import { waitForSheetDismiss } from "../../../components/ui/sheet-dismiss";
import type { CustomersInviteFormCopy } from "../../../i18n/customers";
import { resolveArmedInvitationLeave } from "./invitation-form-leave";

export function useUnsavedInvitationGuard(args: {
  readonly dirty: boolean;
  readonly pending: boolean;
  readonly copy: CustomersInviteFormCopy;
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
    const resolved = resolveArmedInvitationLeave(pendingLeaveActionRef.current);
    pendingLeaveActionRef.current = null;
    if (resolved.kind === "dispatch") {
      navigation.dispatch(resolved.action);
    }
  }, [leaveArmed, navigation]);

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
