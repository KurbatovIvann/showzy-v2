import type { QueryFailureKind } from "../../../../api/errors";

export type ProductQueryLoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "not-found" }
  | { readonly kind: "ready" };

export type ProductPhotosLoadState =
  ProductQueryLoadState | { readonly kind: "permission" };

export function classifyProductPhotosLoad(args: {
  readonly canWrite: boolean;
  readonly productId: string | null;
  readonly requireProduct: boolean;
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
}): ProductPhotosLoadState {
  if (!args.canWrite) {
    return { kind: "permission" };
  }
  if (!args.requireProduct) {
    if (!args.clientReady) {
      return { kind: "error" };
    }
    return { kind: "ready" };
  }
  return classifyProductDetail({
    productId: args.productId,
    clientReady: args.clientReady,
    status: args.status,
    failureKind: args.failureKind,
  });
}

export function classifyProductDetail(args: {
  readonly productId: string | null;
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
}): ProductQueryLoadState {
  if (args.productId === null) {
    return { kind: "not-found" };
  }
  if (!args.clientReady) {
    return { kind: "error" };
  }
  if (args.status === "pending") {
    return { kind: "loading" };
  }
  if (args.status === "error") {
    if (args.failureKind === "offline") {
      return { kind: "offline" };
    }
    if (args.failureKind === "not_found") {
      return { kind: "not-found" };
    }
    return { kind: "error" };
  }
  return { kind: "ready" };
}
