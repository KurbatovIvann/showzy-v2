/**
 * Dirty-leave policy for the document create form (SHO-238). After a
 * successful create the form stays on this screen so the handover sheet
 * can show. Copy invitations: arming leave must not auto-`router.back()`.
 */
export function documentFormLeaveBlocked(args: {
  readonly dirty: boolean;
  readonly pending: boolean;
  readonly leaveArmed: boolean;
}): boolean {
  return args.dirty && !args.pending && !args.leaveArmed;
}

export type ArmedDocumentLeave<TAction> =
  | { readonly kind: "dispatch"; readonly action: TAction }
  | { readonly kind: "none" };

export function resolveArmedDocumentLeave<TAction>(
  pendingAction: TAction | null,
): ArmedDocumentLeave<TAction> {
  if (pendingAction !== null) {
    return { kind: "dispatch", action: pendingAction };
  }
  return { kind: "none" };
}
