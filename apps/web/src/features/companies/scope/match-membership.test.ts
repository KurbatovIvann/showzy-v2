import { describe, expect, it } from "vitest";

import type { CompanyMembership } from "../api/list-mine";
import { matchMembershipBySlug } from "./match-membership";

const flowers: CompanyMembership = {
  membershipId: "c0c0c0c0-0000-4000-8000-000000000011",
  role: "owner",
  permissions: [],
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
  permissions: [
    "files:view",
    "orders:create",
    "orders:edit",
    "orders:view",
  ],
  company: {
    id: "c0c0c0c0-0000-4000-8000-000000000002",
    name: "Пекарня",
    slug: "pekarnya",
    prefix: "PK",
  },
};

describe("matchMembershipBySlug", () => {
  it("matches a membership by slug and ignores unknown slugs", () => {
    expect(matchMembershipBySlug([flowers, bakery], "pekarnya")).toEqual(
      bakery,
    );
    expect(matchMembershipBySlug([flowers], "missing")).toBeUndefined();
  });
});
