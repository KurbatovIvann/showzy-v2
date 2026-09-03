import type { QueryFailureKind } from "../../../api/errors";

export type OrderQueryLoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "error" }
  | { readonly kind: "not-found" }
  | { readonly kind: "ready" };

export function classifyOrderDetail(args: {
  readonly orderId: string | null;
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
}): OrderQueryLoadState {
  if (args.orderId === null) {
    return { kind: "not-found" };
  }
  if (!args.clientReady || args.status === "pending") {
    return { kind: "loading" };
  }
  if (args.status === "error") {
    if (args.failureKind === "not_found") {
      return { kind: "not-found" };
    }
    return { kind: "error" };
  }
  return { kind: "ready" };
}
