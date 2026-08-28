/**
 * Dirty-leave for the price-list form (SHO-190). Price-list-local: dirty
 * is RHF plus domain snapshot. Do not hoist to a generic navigator guard.
 */
import { useNavigation, useRouter } from "expo-router";
import {
  usePreventRemove,
  type NavigationAction,
} from "expo-router/react-navigation";
import { useEffect, useRef, useState } from "react";

import { presentConfirmDialog } from "../../../components/ui/present-confirm-dialog";
import type { PricingFormCopy } from "../../../i18n/pricing";
import { shouldPreventPriceListLeave } from "./price-list-form-draft";

export function useUnsavedPriceListGuard(args: {
  readonly dirty: boolean;
  readonly pending: boolean;
  readonly copy: PricingFormCopy;
}): {
  readonly requestLeave: () => void;
  readonly armLeave: () => void;
} {
  const { dirty, pending, copy } = args;
  const router = useRouter();
  const navigation = useNavigation();
  const [leaveArmed, setLeaveArmed] = useState(false);
  const pendingLeaveActionRef = useRef<NavigationAction | null>(null);
  const leavePromptingRef = useRef(false);
  const prevent = shouldPreventPriceListLeave({
    dirty,
    pending,
    leaveArmed,
  });

  usePreventRemove(prevent, ({ data }) => {
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
