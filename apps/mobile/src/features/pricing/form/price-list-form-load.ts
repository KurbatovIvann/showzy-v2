/**
 * Create/edit price-list form load classification (SHO-190). Permission
 * is decided from `canManagePriceLists` before any write or get.
 */
import type { QueryFailureKind } from "../../../api/errors";
import type { PriceListFormMode } from "./price-list-form-draft";

export type PriceListFormLoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "not-found" }
  | { readonly kind: "permission" }
  | { readonly kind: "ready" };

export function classifyPriceListFormLoad(args: {
  readonly mode: PriceListFormMode;
  readonly canManage: boolean;
  readonly priceListId: string | null;
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
}): PriceListFormLoadState {
  if (!args.canManage) {
    return { kind: "permission" };
  }
  if (args.mode === "create") {
    if (!args.clientReady) {
      return { kind: "error" };
    }
    return { kind: "ready" };
  }
  if (args.priceListId === null) {
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

export function combinePriceListFormQueries(
  queries: ReadonlyArray<{
    readonly status: "pending" | "error" | "success";
    readonly failureKind: QueryFailureKind | null;
  }>,
): {
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
} {
  for (const query of queries) {
    if (query.status === "error" && query.failureKind === "not_found") {
      return { status: "error", failureKind: "not_found" };
    }
  }
  for (const query of queries) {
    if (query.status === "error") {
      return { status: "error", failureKind: query.failureKind };
    }
  }
  if (queries.some((query) => query.status === "pending")) {
    return { status: "pending", failureKind: null };
  }
  return { status: "success", failureKind: null };
}

export function canSubmitPriceListForm(args: {
  readonly canManage: boolean;
  readonly loadKind: PriceListFormLoadState["kind"];
}): boolean {
  return args.canManage && args.loadKind === "ready";
}
