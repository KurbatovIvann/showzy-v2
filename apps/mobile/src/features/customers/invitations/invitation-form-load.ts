/**
 * Create-only invitation form load classification (SHO-206).
 */
export type InvitationFormLoadState =
  | { readonly kind: "error" }
  | { readonly kind: "permission" }
  | { readonly kind: "ready" };

export function classifyInvitationFormLoad(args: {
  readonly canInvite: boolean;
  readonly clientReady: boolean;
}): InvitationFormLoadState {
  if (!args.canInvite) {
    return { kind: "permission" };
  }
  if (!args.clientReady) {
    return { kind: "error" };
  }
  return { kind: "ready" };
}
