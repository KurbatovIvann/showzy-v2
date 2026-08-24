import type { QueryClient } from "@tanstack/react-query";

import {
  listMineQueryKey,
  type ListMineOutput,
} from "../api/company-membership-query";
import type { CompanyResolution } from "./resolve-company";

export function applyCompanyResolution(args: {
  readonly resolution: CompanyResolution;
  readonly sessionUserId: string;
  readonly queryClient: QueryClient;
  readonly setActiveCompany: (companyId: string | null) => void;
  readonly replace: (href: "/onboarding/company" | "/orders") => void;
}): void {
  const resolution = args.resolution;
  if (resolution.kind === "onboarding") {
    if (resolution.clearSelector) {
      args.setActiveCompany(null);
    }
    args.replace("/onboarding/company");
    return;
  }
  if (resolution.kind === "select") {
    args.setActiveCompany(resolution.membership.company.id);
    seedMemberships(args.queryClient, args.sessionUserId, {
      memberships: [resolution.membership],
    });
    args.replace("/orders");
    return;
  }
  if (resolution.kind === "multiple-unresolved" && resolution.clearSelector) {
    args.setActiveCompany(null);
    seedMemberships(args.queryClient, args.sessionUserId, {
      memberships: resolution.memberships,
    });
  }
}

function seedMemberships(
  queryClient: QueryClient,
  sessionUserId: string,
  data: ListMineOutput,
): void {
  queryClient.setQueryData(listMineQueryKey(sessionUserId), data);
}
