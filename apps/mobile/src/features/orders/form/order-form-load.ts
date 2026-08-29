/**
 * Create-only order form load classification (SHO-213).
 */
export type OrderFormLoadState =
  | { readonly kind: "error" }
  | { readonly kind: "permission" }
  | { readonly kind: "ready" };

export function classifyOrderFormLoad(args: {
  readonly canCreate: boolean;
  readonly clientReady: boolean;
}): OrderFormLoadState {
  if (!args.canCreate) {
    return { kind: "permission" };
  }
  if (!args.clientReady) {
    return { kind: "error" };
  }
  return { kind: "ready" };
}
