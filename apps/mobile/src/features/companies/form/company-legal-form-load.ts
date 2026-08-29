/**
 * Company legal editor load classification (SHO-225). Permission is
 * decided from `canViewCompanySettings` before any `companies.get`.
 * Add vs edit is inferred from the get payload (no route `mode`); keep
 * `loading` until hydrate has applied that payload so a warm cache cannot
 * first-paint the empty ФОП add draft.
 */
import type { QueryFailureKind } from "../../../api/errors";
import type { CompanyLegalView } from "../api/company.queries";
import type {
  CompanyLegalFormMode,
  CompanyLegalFormSnapshot,
} from "./company-legal-form-draft";

export type CompanyLegalFormLoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "permission" }
  | { readonly kind: "ready" };

export function companyLegalFormMode(args: {
  readonly legal: CompanyLegalView | undefined;
  readonly baseline: CompanyLegalFormSnapshot | null;
}): CompanyLegalFormMode {
  if (args.legal !== undefined && args.legal !== null) {
    return "edit";
  }
  return args.baseline !== null ? "edit" : "add";
}

export function classifyCompanyLegalFormLoad(args: {
  readonly canView: boolean;
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
  readonly hydrated: boolean;
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
  if (!args.hydrated) {
    return { kind: "loading" };
  }
  return { kind: "ready" };
}
