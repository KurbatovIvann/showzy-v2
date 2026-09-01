/**
 * Invitation create leave policy (SHO-206 / SHO-307). After a successful
 * `invites.create` the once-only token/url stays until Done / Back.
 * Form-kit `dispatch-only` is the same stay-on-screen handover.
 */
import { resolveArmedFormLeave } from "../../../components/form-kit";

export function resolveArmedInvitationLeave<TAction>(
  pendingAction: TAction | null,
) {
  return resolveArmedFormLeave({
    pendingAction,
    mode: "dispatch-only",
  });
}
