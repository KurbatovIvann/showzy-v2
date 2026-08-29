/**
 * Company legal editor load classification (SHO-225). Permission is
 * decided from `canViewCompanySettings` before any `companies.get`.
 */
import type { QueryFailureKind } from "../../../api/errors";

export type CompanyLegalFormLoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "permission" }
  | { readonly kind: "ready" };

export function classifyCompanyLegalFormLoad(args: {
  readonly canView: boolean;
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
}): CompanyLegalFormLoadState {
  if (!args.canView) {
    return { kind: "permission" };
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
    if (args.failureKind === "permission") {
      return { kind: "permission" };
    }
    return { kind: "error" };
  }
  return { kind: "ready" };
}
