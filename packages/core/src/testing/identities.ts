/**
 * Stable kit identities — the same UUIDs as the db.md §8 parity fixtures,
 * given the names the isolation suites speak (`company A` / `user Anna`).
 */
import { parityIds } from "@showzy/db/testing/fixtures";

export const kitIdentities = {
  users: {
    anna: parityIds.users.anna,
    boris: parityIds.users.boris,
  },
  companies: {
    a: parityIds.companies.published,
    b: parityIds.companies.unpublished,
  },
  products: parityIds.products,
  comments: parityIds.comments,
  crmSentinel: parityIds.crmSentinel,
} as const;

export type KitIdentities = typeof kitIdentities;
