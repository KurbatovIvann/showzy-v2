import { describe, expect, it, vi } from "vitest";

import {
  listMineQueryKey,
  type CompanyMembership,
} from "../api/company-membership-query";
import { createShowzyQueryClient } from "../api/query-client";
import { applyCompanyResolution } from "./apply-company-resolution";
import { resolveCompany } from "./resolve-company";

const sessionUserId = "user-a";
const membership: CompanyMembership = {
  membershipId: "membership-a",
  role: "owner",
  company: {
    id: "company-a",
    name: "Alpha",
    slug: "alpha",
    prefix: "ALP",
  },
};

describe("applyCompanyResolution", () => {
  it("selects and persists a single returning membership once", () => {
    const queryClient = createShowzyQueryClient({ retryDelay: () => 0 });
    let activeCompanyId: string | null = null;
    const setActiveCompany = vi.fn((companyId: string | null) => {
      activeCompanyId = companyId;
      queryClient.clear();
    });
    const replace = vi.fn();
    const data = { memberships: [membership] };

    applyCompanyResolution({
      resolution: resolveCompany({ status: "success", data }, activeCompanyId),
      sessionUserId,
      queryClient,
      setActiveCompany,
      replace,
    });
    applyCompanyResolution({
      resolution: resolveCompany({ status: "success", data }, activeCompanyId),
      sessionUserId,
      queryClient,
      setActiveCompany,
      replace,
    });

    expect(setActiveCompany).toHaveBeenCalledTimes(1);
    expect(setActiveCompany).toHaveBeenCalledWith("company-a");
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/orders");
    expect(queryClient.getQueryData(listMineQueryKey(sessionUserId))).toEqual(
      data,
    );
  });

  it("clears a removed selector before retaining the multiple-company stub", () => {
    const second = {
      ...membership,
      membershipId: "membership-b",
      company: { ...membership.company, id: "company-b", name: "Beta" },
    };
    const queryClient = createShowzyQueryClient({ retryDelay: () => 0 });
    const events: string[] = [];
    const data = { memberships: [membership, second] };

    applyCompanyResolution({
      resolution: resolveCompany(
        { status: "success", data },
        "foreign-company",
      ),
      sessionUserId,
      queryClient,
      setActiveCompany: (companyId) => {
        events.push(`selector:${companyId ?? "null"}`);
        queryClient.clear();
      },
      replace: (href) => {
        events.push(`route:${href}`);
      },
    });

    expect(events).toEqual(["selector:null"]);
    expect(queryClient.getQueryData(listMineQueryKey(sessionUserId))).toEqual(
      data,
    );
  });

  it("routes zero memberships to onboarding but never does so for errors", () => {
    const queryClient = createShowzyQueryClient({ retryDelay: () => 0 });
    const setActiveCompany = vi.fn();
    const replace = vi.fn();

    applyCompanyResolution({
      resolution: resolveCompany(
        { status: "success", data: { memberships: [] } },
        "removed-company",
      ),
      sessionUserId,
      queryClient,
      setActiveCompany,
      replace,
    });
    applyCompanyResolution({
      resolution: resolveCompany({ status: "error" }, "removed-company"),
      sessionUserId,
      queryClient,
      setActiveCompany,
      replace,
    });

    expect(setActiveCompany).toHaveBeenCalledOnce();
    expect(setActiveCompany).toHaveBeenCalledWith(null);
    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith("/onboarding/company");
  });
});
