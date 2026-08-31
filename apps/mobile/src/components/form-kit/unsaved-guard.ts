/**
 * Pure unsaved-leave policy (SHO-300). The hook wires `usePreventRemove`
 * and the confirm dialog; this file stays React-free for Vitest.
 */

export type ArmedFormLeaveMode = "dispatch-or-back" | "dispatch-only";

export type ArmedFormLeave<TAction> =
  | { readonly kind: "dispatch"; readonly action: TAction }
  | { readonly kind: "back" }
  | { readonly kind: "none" };

export type UnsavedGuardCopy = {
  readonly leaveTitle: string;
  readonly leaveDescription: string;
  readonly leaveConfirm: string;
  readonly leaveContinue: string;
};

export function formLeaveBlocked(args: {
  readonly dirty: boolean;
  readonly pending: boolean;
  readonly leaveArmed: boolean;
}): boolean {
  return args.dirty && !args.pending && !args.leaveArmed;
}

export function resolveArmedFormLeave<TAction>(args: {
  readonly pendingAction: TAction | null;
  readonly mode: ArmedFormLeaveMode;
}): ArmedFormLeave<TAction> {
  if (args.pendingAction !== null) {
    return { kind: "dispatch", action: args.pendingAction };
  }
  if (args.mode === "dispatch-only") {
    return { kind: "none" };
  }
  return { kind: "back" };
}

export function unsavedGuardSheetHandshake(sheetOpen: boolean): {
  readonly waitForDismiss: boolean;
} {
  return { waitForDismiss: sheetOpen };
}
