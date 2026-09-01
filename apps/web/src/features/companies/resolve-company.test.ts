import { describe, expect, it } from "vitest";

import type { CompanyMembership } from "../../api/company-membership-query";
import {
  lastVisitedSlugToRedirect,
  matchMembershipBySlug,
} from "./resolve-company";

const flowers: CompanyMembership = {
  membershipId: "c0c0c0c0-0000-4000-8000-000000000011",
  role: "owner",
  company: {
    id: "c0c0c0c0-0000-4000-8000-000000000001",
    name: "Квіти Львів",
    slug: "kviti-lviv",
    prefix: "KL",
  },
};

const bakery: CompanyMembership = {
  membershipId: "c0c0c0c0-0000-4000-8000-000000000012",
  role: "manager",
  company: {
    id: "c0c0c0c0-0000-4000-8000-000000000002",
    name: "Пекарня",
    slug: "pekarnya",
    prefix: "PK",
  },
};

describe("resolve company slug", () => {
  it("matches a membership by slug and ignores unknown slugs", () => {
    expect(matchMembershipBySlug([flowers, bakery], "pekarnya")).toEqual(
      bakery,
    );
    expect(matchMembershipBySlug([flowers], "missing")).toBeUndefined();
  });

  it("redirects to the last visited slug only when it is still a membership", () => {
    expect(lastVisitedSlugToRedirect([flowers, bakery], "kviti-lviv")).toBe(
      "kviti-lviv",
    );
    expect(lastVisitedSlugToRedirect([flowers], "pekarnya")).toBeNull();
    expect(lastVisitedSlugToRedirect([flowers], null)).toBeNull();
    expect(lastVisitedSlugToRedirect([], "kviti-lviv")).toBeNull();
  });
});
