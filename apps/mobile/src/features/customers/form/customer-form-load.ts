/**
 * Create/edit customer form load classification (SHO-180).
 */
import type { QueryFailureKind } from "../../../api/errors";
import type { CustomerFormMode } from "./customer-form-draft";

export type CustomerFormLoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "not-found" }
  | { readonly kind: "permission" }
  | { readonly kind: "ready" };

export function classifyCustomerFormLoad(args: {
  readonly mode: CustomerFormMode;
  readonly canWrite: boolean;
  readonly customerId: string | null;
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
}): CustomerFormLoadState {
  if (!args.canWrite) {
    return { kind: "permission" };
  }
  if (args.mode === "create") {
    if (!args.clientReady) {
      return { kind: "error" };
    }
    return { kind: "ready" };
  }
  if (args.customerId === null) {
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
