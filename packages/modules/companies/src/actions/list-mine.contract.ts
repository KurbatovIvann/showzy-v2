/**
 * Account read contract for SHO-126 (feature SHO-125). Mechanical choices
 * the feature card left unnamed, following the golden read contract
 * (pricing.resolveProductPrices):
 * - `aiExposure: "exposed"` — a safe own-user read, the account-session
 *   tool the AI surface lists (contract.md §2).
 * - `timeout: 5000` matches the golden read actions.
 * - Rate limit stays at the account default (90/min per user).
 * - Output wrapper is `{ memberships: [...] }`; stable order is membership
 *   `created_at` then membership id, so renames cannot reshuffle the list.
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

/** Foundation role vocabulary (companies-foundation.md §2). */
export const companyMemberRoleSchema = z.enum([
  "owner",
  "admin",
  "manager",
  "employee",
]);

export const companyMembershipViewSchema = z.object({
  membershipId: z.uuid(),
  role: companyMemberRoleSchema,
  company: z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    prefix: z.string(),
  }),
});

/** Never accepts a user, company, or membership identifier (ADR-0013). */
export const listMineInputSchema = z.strictObject({});

export const listMineOutputSchema = z.object({
  memberships: z.array(companyMembershipViewSchema),
});

export const listMineContract = defineActionContract({
  name: "companies.listMine",
  description:
    "List the authenticated user's own company memberships with each company's identity (id, name, slug, numbering prefix) and the caller's membership id and role, in stable creation order. Returns an empty list for an account with no memberships. Takes no input; the caller is derived from the verified session only.",
  principal: "account",
  transport: "client",
  input: listMineInputSchema,
  output: listMineOutputSchema,
  permissions: [],
  aiExposure: "exposed",
  risk: "read",
  requiresConfirmation: false,
  idempotent: false,
  emits: [],
  atomicCalls: [],
  atomicCallers: [],
  audit: false,
  timeout: 5_000,
});
