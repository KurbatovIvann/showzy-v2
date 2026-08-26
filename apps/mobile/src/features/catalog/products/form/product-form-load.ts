/**
 * Create/edit product form load classification (SHO-163).
 */
import type { QueryFailureKind } from "../../../../api/errors";
import { classifyProductDetail } from "../shared/classify-product-load";
import type { ProductFormMode } from "./product-form-draft";

export type ProductFormLoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "not-found" }
  | { readonly kind: "permission" }
  | { readonly kind: "ready" };

export function classifyProductFormLoad(args: {
  readonly mode: ProductFormMode;
  readonly canWrite: boolean;
  readonly productId: string | null;
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
}): ProductFormLoadState {
  if (!args.canWrite) {
    return { kind: "permission" };
  }
  if (args.mode === "create") {
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
