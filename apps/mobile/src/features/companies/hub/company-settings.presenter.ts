/**
 * Pure view-model logic for the company settings hub (SHO-226). No
 * React Native imports so permission, attention vs filled legal row,
 * load classification, and row a11y are unit-testable.
 */
import type { QueryFailureKind } from "../../../api/errors";
import { interpolate } from "../../../i18n/locale";

export type CompanySettingsState =
  | { readonly kind: "permission" }
  | { readonly kind: "loading" }
  | { readonly kind: "offline" }
  | { readonly kind: "error" }
  | { readonly kind: "ready" };

/**
 * Permission is decided from `canViewCompanySettings` before any get.
 * A permission failure from the wire maps to the same empty state so a
 * deep link cannot show another company's legal row.
 */
export function classifyCompanySettings(args: {
  readonly canView: boolean;
  readonly clientReady: boolean;
  readonly status: "pending" | "error" | "success";
  readonly failureKind: QueryFailureKind | null;
}): CompanySettingsState {
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

export type CompanyIdentityView = {
  readonly name: string;
  readonly slugDisplay: string;
  readonly prefix: string;
  readonly prefixExplanation: string;
};

export function companyIdentityView(args: {
  readonly name: string;
  readonly slug: string;
  readonly prefix: string;
  readonly slugDisplayTemplate: string;
  readonly prefixExplanationTemplate: string;
}): CompanyIdentityView {
  return {
    name: args.name,
    slugDisplay: interpolate(args.slugDisplayTemplate, { slug: args.slug }),
    prefix: args.prefix,
    prefixExplanation: interpolate(args.prefixExplanationTemplate, {
      prefix: args.prefix,
    }),
  };
}

export type CompanyLegalStubState =
  | { readonly kind: "permission" }
  | { readonly kind: "stub" };

/**
 * Legal stub (and SHO-225 editor) reuses the hub view-permission gate.
 * No `companies.get` — manager/employee deep-links must not see PII.
 */
export function classifyCompanyLegalStub(args: {
  readonly canView: boolean;
}): CompanyLegalStubState {
  if (!args.canView) {
    return { kind: "permission" };
  }
  return { kind: "stub" };
}

/**
 * VoiceOver must hear attention vs legal name — status is never
 * color-only (`docs/design/mapping/mp-to-mobile.md`).
 */
export function companySettingsRowAccessibilityLabel(args: {
  readonly label: string;
  readonly description: string;
}): string {
  if (args.description.length === 0) {
    return args.label;
  }
  return `${args.label}. ${args.description}`;
}

export type CompanyLegalRowView = {
  readonly description: string;
  readonly attention: boolean;
};

/**
 * Attention copy only when `legal` is null. A present legal row is
 * filled even if `legalName` is empty — the editor ticket owns fields.
 */
export function companyLegalRow(args: {
  readonly legal: { readonly legalName: string | null } | null;
  readonly missingLabel: string;
}): CompanyLegalRowView {
  if (args.legal === null) {
    return { description: args.missingLabel, attention: true };
  }
  return {
    description: args.legal.legalName ?? "",
    attention: false,
  };
}
