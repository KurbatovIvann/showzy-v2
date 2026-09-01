/**
 * Dirty-leave policy for the document create form (SHO-238 / SHO-306).
 * After a successful create the form stays on this screen so the
 * handover sheet can show. Form-kit `dispatch-only` is the same
 * stay-on-screen handover as invitations.
 */
import {
  formLeaveBlocked,
  resolveArmedFormLeave,
} from "../../../components/form-kit/unsaved-guard";

export function documentFormLeaveBlocked(args: {
  readonly dirty: boolean;
  readonly pending: boolean;
  readonly leaveArmed: boolean;
}): boolean {
  return formLeaveBlocked(args);
}

export function resolveArmedDocumentLeave<TAction>(
  pendingAction: TAction | null,
) {
  return resolveArmedFormLeave({
    pendingAction,
    mode: "dispatch-only",
  });
}
