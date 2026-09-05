import { describe, expect, it, vi } from "vitest";

import type { CompanyMembership } from "../api/company-membership-query";
import { applyCompanyResolution } from "./apply-company-resolution";
import { resolveCompany } from "./resolve-company";

const membership: CompanyMembership = {
  membershipId: "membership-a",
  role: "owner",
  permissions: [],
  company: {
    id: "company-a",
    name: "Alpha",
    slug: "alpha",
    prefix: "ALP",
  },
};

describe("applyCompanyResolution", () => {
  it("selects and persists a single returning membership once", () => {
    let activeCompanyId: string | null = null;
    const setActiveCompany = vi.fn((companyId: string | null) => {
      activeCompanyId = companyId;
    });
    const replace = vi.fn();
    const data = { memberships: [membership] };

    applyCompanyResolution({
      resolution: resolveCompany({ status: "success", data }, activeCompanyId),
      setActiveCompany,
      replace,
    });
    applyCompanyResolution({
      resolution: resolveCompany({ status: "success", data }, activeCompanyId),
      setActiveCompany,
      replace,
    });

    expect(setActiveCompany).toHaveBeenCalledTimes(1);
    expect(setActiveCompany).toHaveBeenCalledWith("company-a");
    expect(replace).not.toHaveBeenCalled();
  });

  it("clears a removed selector before retaining the multiple-company stub", () => {
    const second = {
      ...membership,
      membershipId: "membership-b",
      company: { ...membership.company, id: "company-b", name: "Beta" },
    };
    const events: string[] = [];
    const data = { memberships: [membership, second] };

    applyCompanyResolution({
      resolution: resolveCompany(
        { status: "success", data },
        "foreign-company",
      ),
      setActiveCompany: (companyId) => {
        events.push(`selector:${companyId ?? "null"}`);
      },
      replace: (href) => {
        events.push(`route:${href}`);
      },
    });

    expect(events).toEqual(["selector:null"]);
  });

  it("routes zero memberships to onboarding but never does so for errors", () => {
    const setActiveCompany = vi.fn();
    const replace = vi.fn();

    applyCompanyResolution({
      resolution: resolveCompany(
        { status: "success", data: { memberships: [] } },
        "removed-company",
      ),
      setActiveCompany,
      replace,
    });
    applyCompanyResolution({
      resolution: resolveCompany({ status: "error" }, "removed-company"),
      setActiveCompany,
      replace,
    });

    expect(setActiveCompany).toHaveBeenCalledOnce();
    expect(setActiveCompany).toHaveBeenCalledWith(null);
    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith("/onboarding/company");
  });
});
