import type { ActionCtx } from "@showzy/core";
import { NotFoundError } from "@showzy/core/errors";
import { customerGroups } from "@showzy/db/schema/customers";
import { and, eq } from "drizzle-orm";

import { resolveGroupPriceListId } from "./resolve-price-list.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;

export async function assertCustomerAssignments(env: {
  readonly ctx: StaffCtx;
  readonly groupId: string | null;
  readonly priceListId: string | null;
}): Promise<void> {
  if (env.groupId !== null) {
    await requireOwnGroup(env.ctx, env.groupId);
  }
  if (env.priceListId !== null) {
    await resolveGroupPriceListId(env.ctx, env.priceListId);
  }
}

async function requireOwnGroup(ctx: StaffCtx, groupId: string): Promise<void> {
  const row = (
    await ctx.db
      .select({ id: customerGroups.id })
      .from(customerGroups)
      .where(
        and(
          eq(customerGroups.companyId, ctx.companyId),
          eq(customerGroups.id, groupId),
        ),
      )
      .limit(1)
  )[0];
  if (row === undefined) {
    throw new NotFoundError();
  }
}
