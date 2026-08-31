/**
 * Dirty-leave for staff forms (SHO-300). Optional sheet-dismiss handshake
 * before the confirm dialog. Armed leave defaults to dispatch-or-back
 * (stay-on-screen handover uses `dispatch-only`).
 */
import { useNavigation, useRouter } from "expo-router";
import {
  usePreventRemove,
  type NavigationAction,
} from "expo-router/react-navigation";
import { useEffect, useRef, useState } from "react";

import { presentConfirmDialog } from "../ui/present-confirm-dialog";
import { waitForSheetDismiss } from "../ui/sheet-dismiss";
import {
  formLeaveBlocked,
  resolveArmedFormLeave,
  unsavedGuardSheetHandshake,
  type ArmedFormLeaveMode,
  type UnsavedGuardCopy,
} from "./unsaved-guard";

export function useUnsavedGuard(args: {
  readonly dirty: boolean;
  readonly pending: boolean;
  readonly copy: UnsavedGuardCopy;
  readonly sheetOpen?: boolean;
  readonly closeSheet?: () => void;
  readonly armedLeave?: ArmedFormLeaveMode;
}): {
  readonly requestLeave: () => void;
  readonly armLeave: () => void;
} {
  const { dirty, pending, copy } = args;
  const sheetOpen = args.sheetOpen === true;
  const armedLeave = args.armedLeave ?? "dispatch-or-back";
  const router = useRouter();
  const navigation = useNavigation();
  const [leaveArmed, setLeaveArmed] = useState(false);
  const pendingLeaveActionRef = useRef<NavigationAction | null>(null);
  const leavePromptingRef = useRef(false);
  const sheetOpenRef = useRef(sheetOpen);
  sheetOpenRef.current = sheetOpen;
  const closeSheetRef = useRef(args.closeSheet);
  closeSheetRef.current = args.closeSheet;
  const armedLeaveRef = useRef(armedLeave);
  armedLeaveRef.current = armedLeave;

  usePreventRemove(
    formLeaveBlocked({ dirty, pending, leaveArmed }),
    ({ data }) => {
      pendingLeaveActionRef.current = data.action;
      void promptLeave();
    },
  );

  useEffect(() => {
    if (!leaveArmed) {
      return;
    }
    const resolved = resolveArmedFormLeave({
      pendingAction: pendingLeaveActionRef.current,
      mode: armedLeaveRef.current,
    });
    pendingLeaveActionRef.current = null;
    if (resolved.kind === "dispatch") {
      navigation.dispatch(resolved.action);
      return;
    }
    if (resolved.kind === "back") {
      router.back();
    }
  }, [leaveArmed, navigation, router]);

  async function promptLeave(): Promise<void> {
    if (leavePromptingRef.current) {
      return;
    }
    leavePromptingRef.current = true;
    const handshake = unsavedGuardSheetHandshake(sheetOpenRef.current);
    closeSheetRef.current?.();
    if (handshake.waitForDismiss) {
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
