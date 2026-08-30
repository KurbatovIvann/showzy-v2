/**
 * Create-only document form load classification (SHO-238).
 */
export type DocumentFormLoadState =
  | { readonly kind: "error" }
  | { readonly kind: "permission" }
  | { readonly kind: "ready" };

export function classifyDocumentFormLoad(args: {
  readonly canCreate: boolean;
  readonly clientReady: boolean;
}): DocumentFormLoadState {
  if (!args.canCreate) {
    return { kind: "permission" };
  }
  if (!args.clientReady) {
    return { kind: "error" };
  }
  return { kind: "ready" };
}
