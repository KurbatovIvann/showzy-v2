import type {
  CompanyMembership,
  ListMineOutput,
} from "../api/company-membership-query";

export type CompanyResolution =
  | { readonly kind: "loading" }
  | { readonly kind: "error" }
  | { readonly kind: "onboarding"; readonly clearSelector: boolean }
  | {
      readonly kind: "select";
      readonly membership: CompanyMembership;
    }
  | {
      readonly kind: "ready";
      readonly membership: CompanyMembership;
    }
  | {
      readonly kind: "multiple-unresolved";
      readonly memberships: readonly CompanyMembership[];
      readonly clearSelector: boolean;
    };

export type MembershipQueryState =
  | { readonly status: "loading" }
  | { readonly status: "error" }
  | { readonly status: "success"; readonly data: ListMineOutput };

export function membershipQueryState(args: {
  readonly data: ListMineOutput | undefined;
  readonly isError: boolean;
  readonly clientReady: boolean;
  readonly sessionReady: boolean;
}): MembershipQueryState {
  if (args.data !== undefined) {
    return { status: "success", data: args.data };
  }
  if (!args.clientReady || !args.sessionReady || args.isError) {
    return { status: "error" };
  }
  return { status: "loading" };
}

export function resolveCompany(
  query: MembershipQueryState,
  activeCompanyId: string | null,
): CompanyResolution {
  if (query.status === "loading") {
    return { kind: "loading" };
  }
  if (query.status === "error") {
    return { kind: "error" };
  }

  const memberships = query.data.memberships;
  if (memberships.length === 0) {
    return {
      kind: "onboarding",
      clearSelector: activeCompanyId !== null,
    };
  }

  if (memberships.length === 1) {
    const membership = memberships[0];
    if (membership === undefined) {
      return { kind: "error" };
    }
    return membership.company.id === activeCompanyId
      ? { kind: "ready", membership }
      : { kind: "select", membership };
  }

  const selected = memberships.find(
    (membership) => membership.company.id === activeCompanyId,
  );
  if (selected !== undefined) {
    return { kind: "ready", membership: selected };
  }

  return {
    kind: "multiple-unresolved",
    memberships,
    clearSelector: activeCompanyId !== null,
  };
}
