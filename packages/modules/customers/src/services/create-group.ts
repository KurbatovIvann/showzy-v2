import { randomUUID } from "node:crypto";

import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { customerGroups } from "@showzy/db/schema/customers";
import type { z } from "zod";

import type {
  createGroupInputSchema,
  createGroupOutputSchema,
} from "../actions/create-group.contract.js";
import {
  CUSTOMER_GROUPS_COMPANY_SLUG_UQ,
  groupFallbackSlug,
  slugFromName,
} from "./group-slug.js";
import {
  storedDescription,
  storedPriceListId,
  toGroupView,
} from "./group-view.js";
import { postgresUniqueConstraint } from "./postgres-unique.js";
import { resolveGroupPriceListId } from "./resolve-price-list.js";
import { requireWritable, type WritableStaffDb } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type CreateInput = z.output<typeof createGroupInputSchema>;
type GroupView = z.output<typeof createGroupOutputSchema>;

const SLUG_ALLOCATION_ATTEMPTS = 8;

const groupReturning = {
  id: customerGroups.id,
  name: customerGroups.name,
  slug: customerGroups.slug,
  description: customerGroups.description,
  priceListId: customerGroups.priceListId,
  createdAt: customerGroups.createdAt,
  updatedAt: customerGroups.updatedAt,
} as const;

export async function createStaffGroup(env: {
  readonly ctx: StaffCtx;
  readonly input: CreateInput;
}): Promise<GroupView> {
  const { ctx, input } = env;
  const priceListId = await resolveGroupPriceListId(ctx, input.priceListId);
  const db = requireWritable(ctx.db);
  const row = await insertGroupWithAllocatedSlug(db, {
    companyId: ctx.companyId,
    name: input.name,
    description: storedDescription(input.description),
    priceListId: storedPriceListId(priceListId),
  });

  ctx.log.info({ group_id: row.id }, "customers.createGroup created group");

  return toGroupView(row, 0);
}

async function insertGroupWithAllocatedSlug(
  db: WritableStaffDb,
  values: {
    readonly companyId: string;
    readonly name: string;
    readonly description: string | null;
    readonly priceListId: string | null;
  },
): Promise<{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceListId: string | null;
  createdAt: Date;
  updatedAt: Date;
}> {
  const preferred = slugFromName(values.name);
  let slug = preferred ?? groupFallbackSlug();

  for (let attempt = 0; attempt < SLUG_ALLOCATION_ATTEMPTS; attempt += 1) {
    const id = randomUUID();
    try {
      const inserted = (
        await db
          .insert(customerGroups)
          .values({
            id,
            companyId: values.companyId,
            name: values.name,
            slug,
            description: values.description,
            sortOrder: 0,
            priceListId: values.priceListId,
          })
          .returning(groupReturning)
      )[0];
      if (inserted === undefined) {
        throw new CoreInvariantError(
          "customers.createGroup insert returned no row",
        );
      }
      return inserted;
    } catch (error) {
      if (postgresUniqueConstraint(error) !== CUSTOMER_GROUPS_COMPANY_SLUG_UQ) {
        throw error;
      }
      slug = groupFallbackSlug();
    }
  }

  throw new CoreInvariantError(
    "customers.createGroup exhausted slug allocation attempts",
  );
}
