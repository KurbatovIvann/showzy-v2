/**
 * The companies.create domain flow (SHO-127): occupied-slug conflict or
 * identical-owner replay, server-side prefix allocation, and the atomic
 * company + owner-membership insert inside the core-managed transaction.
 */
import { randomUUID } from "node:crypto";

import type { ActionCtx } from "@showzy/core";
import { ConflictError } from "@showzy/core/errors";
import { companies, companyMembers } from "@showzy/db/schema/companies";
import { postgresUniqueConstraint } from "@showzy/module-kit/postgres-unique";
import { and, eq, like } from "drizzle-orm";
import type { z } from "zod";

import type {
  createCompanyInputSchema,
  createCompanyOutputSchema,
} from "../actions/create.contract.js";
import { derivePrefixBase, pickAvailablePrefix } from "./prefix.js";
import { requireWritable, type WritableAccountDb } from "./writable.js";

type AccountCtx = Extract<ActionCtx, { principal: "account" }>;
type CreateInput = z.output<typeof createCompanyInputSchema>;
type MembershipView = z.output<typeof createCompanyOutputSchema>;

/** One fixed client message: never describes the occupying company. */
const OCCUPIED_SLUG_MESSAGE = "This company address is already taken.";

export async function createOwnedCompany(env: {
  readonly ctx: AccountCtx;
  readonly input: CreateInput;
}): Promise<MembershipView> {
  const { ctx, input } = env;
  const db = requireWritable(ctx.db);

  const replayed = await replayOwnIdenticalCreate(db, ctx.userId, input);
  if (replayed !== undefined) {
    return replayed;
  }

  const prefix = await allocatePrefix(db, input.name);
  const companyId = randomUUID();
  const membershipId = randomUUID();
  try {
    await db.insert(companies).values({
      id: companyId,
      name: input.name,
      slug: input.slug,
      prefix,
    });
    await db.insert(companyMembers).values({
      id: membershipId,
      companyId,
      userId: ctx.userId,
      role: "owner",
      permissions: { granted: [], denied: [] },
    });
  } catch (error) {
    throw mapUniqueViolation(error, input.slug);
  }

  return {
    membershipId,
    role: "owner",
    permissions: [],
    company: { id: companyId, name: input.name, slug: input.slug, prefix },
  };
}

/**
 * Domain-level replay (feature card: "retries cannot create duplicate
 * companies or memberships"): the same owner re-submitting the identical
 * name and slug — e.g. a mobile retry that lost the first response and
 * minted a new idempotency key — gets the already-created company back.
 * Any other occupied slug is a conflict; the occupying company's identity
 * stays in the log-only internal message.
 */
async function replayOwnIdenticalCreate(
  db: WritableAccountDb,
  userId: string,
  input: CreateInput,
): Promise<MembershipView | undefined> {
  const occupying = (
    await db
      .select({
        id: companies.id,
        name: companies.name,
        prefix: companies.prefix,
      })
      .from(companies)
      .where(eq(companies.slug, input.slug))
      .limit(1)
  )[0];
  if (occupying === undefined) {
    return undefined;
  }

  if (occupying.name === input.name) {
    const membership = (
      await db
        .select({ id: companyMembers.id, role: companyMembers.role })
        .from(companyMembers)
        .where(
          and(
            eq(companyMembers.companyId, occupying.id),
            eq(companyMembers.userId, userId),
          ),
        )
        .limit(1)
    )[0];
    if (membership !== undefined && membership.role === "owner") {
      return {
        membershipId: membership.id,
        role: "owner",
        permissions: [],
        company: {
          id: occupying.id,
          name: occupying.name,
          slug: input.slug,
          prefix: occupying.prefix,
        },
      };
    }
  }

  throw new ConflictError(OCCUPIED_SLUG_MESSAGE, {
    internalMessage: `slug "${input.slug}" is occupied by company ${occupying.id}`,
  });
}

async function allocatePrefix(
  db: WritableAccountDb,
  name: string,
): Promise<string> {
  const base = derivePrefixBase(name);
  // The base is [A-Z0-9]+ only, so it is LIKE-safe; the superset match
  // (every prefix starting with the base) is exactly the candidate space
  // `pickAvailablePrefix` scans.
  const rows = await db
    .select({ prefix: companies.prefix })
    .from(companies)
    .where(like(companies.prefix, `${base}%`));
  return pickAvailablePrefix(base, new Set(rows.map((row) => row.prefix)));
}

/**
 * The pre-insert checks run at read committed, so a concurrent creation
 * can win the slug or prefix between the check and the insert; the unique
 * indexes are the actual wall. Both races are retryable conflicts.
 */
function mapUniqueViolation(error: unknown, slug: string): unknown {
  const constraint = postgresUniqueConstraint(error);
  if (constraint === "companies_slug_uq") {
    return new ConflictError(OCCUPIED_SLUG_MESSAGE, {
      internalMessage: `slug "${slug}" was taken by a concurrent creation`,
      cause: error,
    });
  }
  if (constraint === "companies_prefix_uq") {
    return new ConflictError("Company creation raced another request. Retry.", {
      internalMessage: "numbering prefix was taken by a concurrent creation",
      cause: error,
    });
  }
  return error;
}
