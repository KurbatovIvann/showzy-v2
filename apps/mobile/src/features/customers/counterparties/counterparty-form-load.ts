/**
 * Create/edit counterparty form load classification (SHO-196).
 */
import type { QueryFailureKind } from "../../../api/errors";
import type { CounterpartyFormMode } from "./counterparty-form-draft";

export type CounterpartyFormLoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "not-found" }
  | { readonly kind: "permission" }
  | { readonly kind: "ready" };

export function classifyCounterpartyFormLoad(args: {
  readonly mode: CounterpartyFormMode;
  readonly canWrite: boolean;
  readonly counterpartyId: string | null;
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
}): CounterpartyFormLoadState {
  if (!args.canWrite) {
    return { kind: "permission" };
  }
  if (args.mode === "create") {
    if (!args.clientReady) {
      return { kind: "error" };
    }
    return { kind: "ready" };
  }
  if (args.counterpartyId === null) {
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
