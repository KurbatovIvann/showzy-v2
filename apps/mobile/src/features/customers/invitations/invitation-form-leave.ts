/**
 * Invitation create leave policy (SHO-206). After a successful
 * `invites.create` the once-only token/url stays on this screen until
 * the user taps Done / Back. Group/product goldens armLeave after save
 * so the editor leaves; invitations must not. Dirty is already
 * `isDirty && created === null`, so arming leave is not required to
 * skip the unsaved prompt.
 *
 * `armLeave` only replays a pending back action. With none, stay —
 * never auto-`router.back()`.
 */

export type ArmedInvitationLeave<TAction> =
  | { readonly kind: "dispatch"; readonly action: TAction }
  | { readonly kind: "none" };

export function resolveArmedInvitationLeave<TAction>(
  pendingAction: TAction | null,
): ArmedInvitationLeave<TAction> {
  if (pendingAction !== null) {
    return { kind: "dispatch", action: pendingAction };
  }
  return { kind: "none" };
}
