import { describe, expect, it } from "vitest";

import type { CompanyMembership } from "../api/list-mine";
import { lastVisitedSlugToRedirect } from "./last-slug-redirect";

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
  permissions: ["files:view", "orders:create", "orders:edit", "orders:view"],
  company: {
    id: "c0c0c0c0-0000-4000-8000-000000000002",
    name: "Пекарня",
    slug: "pekarnya",
    prefix: "PK",
  },
};

describe("lastVisitedSlugToRedirect", () => {
  it("redirects to the last visited slug only when it is still a membership", () => {
    expect(lastVisitedSlugToRedirect([flowers, bakery], "kviti-lviv")).toBe(
      "kviti-lviv",
    );
    expect(lastVisitedSlugToRedirect([flowers], "pekarnya")).toBeNull();
    expect(lastVisitedSlugToRedirect([flowers], null)).toBeNull();
    expect(lastVisitedSlugToRedirect([], "kviti-lviv")).toBeNull();
  });
});
