import { COMPANY_SELECTOR_HEADER } from "@showzy/contract";

import type { CompanyMembership } from "../features/companies/api/list-mine";

export const FLOWERS_COMPANY_ID = "c0c0c0c0-0000-4000-8000-000000000001";
export const BAKERY_COMPANY_ID = "c0c0c0c0-0000-4000-8000-000000000002";

export const FLOWERS_MEMBERSHIP: CompanyMembership = {
  membershipId: "c0c0c0c0-0000-4000-8000-000000000011",
  role: "owner",
  company: {
    id: FLOWERS_COMPANY_ID,
    name: "Квіти Львів",
    slug: "kviti-lviv",
    prefix: "KL",
  },
};

export const BAKERY_MEMBERSHIP: CompanyMembership = {
  membershipId: "c0c0c0c0-0000-4000-8000-000000000012",
  role: "manager",
  company: {
    id: BAKERY_COMPANY_ID,
    name: "Пекарня",
    slug: "pekarnya",
    prefix: "PK",
  },
};

export function signedInOwner(): {
  readonly id: string;
  readonly email: string;
  readonly phoneNumber: null;
} {
  return {
    id: "user-1",
    email: "owner@example.com",
    phoneNumber: null,
  };
}

export { COMPANY_SELECTOR_HEADER };
