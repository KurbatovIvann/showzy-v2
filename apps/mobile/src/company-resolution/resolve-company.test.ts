import { describe, expect, it } from "vitest";

import type { CompanyMembership } from "../api/company-membership-query";
import { membershipQueryState, resolveCompany } from "./resolve-company";

const companyA = membership("company-a", "Alpha");
const companyB = membership("company-b", "Beta");

describe("resolveCompany", () => {
  it.each([
    {
      name: "loading",
      query: { status: "loading" } as const,
      active: null,
      expected: { kind: "loading" },
    },
    {
      name: "error",
      query: { status: "error" } as const,
      active: null,
      expected: { kind: "error" },
    },
    {
      name: "zero memberships",
      query: success([]),
      active: "removed-company",
      expected: { kind: "onboarding", clearSelector: true },
    },
    {
      name: "single returning membership",
      query: success([companyA]),
      active: "company-a",
      expected: { kind: "ready", membership: companyA },
    },
    {
      name: "single membership without a selector",
      query: success([companyA]),
      active: null,
      expected: { kind: "select", membership: companyA },
    },
    {
      name: "stale selector with one membership",
      query: success([companyA]),
      active: "removed-company",
      expected: { kind: "select", membership: companyA },
    },
    {
      name: "multiple memberships with verified selector",
      query: success([companyA, companyB]),
      active: "company-b",
      expected: { kind: "ready", membership: companyB },
    },
    {
      name: "multiple memberships without selector",
      query: success([companyA, companyB]),
      active: null,
      expected: {
        kind: "multiple-unresolved",
        memberships: [companyA, companyB],
        clearSelector: false,
      },
    },
    {
      name: "multiple memberships with foreign selector",
      query: success([companyA, companyB]),
      active: "foreign-company",
      expected: {
        kind: "multiple-unresolved",
        memberships: [companyA, companyB],
        clearSelector: true,
      },
    },
  ])("$name", ({ query, active, expected }) => {
    expect(resolveCompany(query, active)).toEqual(expected);
  });

  it("does not route a query failure to onboarding", () => {
    expect(resolveCompany({ status: "error" }, "stale")).toEqual({
      kind: "error",
    });
  });
});

describe("membershipQueryState", () => {
  it("keeps verified data available when a background refresh fails", () => {
    const data = { memberships: [companyA] };
    expect(
      membershipQueryState({
        data,
        isError: true,
        clientReady: true,
        sessionReady: true,
      }),
    ).toEqual({ status: "success", data });
  });

  it("surfaces unavailable client and initial query failures", () => {
    expect(
      membershipQueryState({
        data: undefined,
        isError: false,
        clientReady: false,
        sessionReady: true,
      }),
    ).toEqual({ status: "error" });
    expect(
      membershipQueryState({
        data: undefined,
        isError: true,
        clientReady: true,
        sessionReady: true,
      }),
    ).toEqual({ status: "error" });
  });
});

function membership(id: string, name: string): CompanyMembership {
  return {
    membershipId: `membership-${id}`,
    role: "owner",
    company: {
      id,
      name,
      slug: name.toLowerCase(),
      prefix: name.slice(0, 3).toUpperCase(),
    },
  };
}

function success(memberships: readonly CompanyMembership[]) {
  return {
    status: "success" as const,
    data: { memberships },
  };
}
