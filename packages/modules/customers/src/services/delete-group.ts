import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { customerGroups } from "@showzy/db/schema/customers";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import type {
  deleteGroupInputSchema,
  deleteGroupOutputSchema,
} from "../actions/delete-group.contract.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type DeleteInput = z.output<typeof deleteGroupInputSchema>;
type DeleteOutput = z.output<typeof deleteGroupOutputSchema>;

export async function deleteStaffGroup(env: {
  readonly ctx: StaffCtx;
  readonly input: DeleteInput;
}): Promise<DeleteOutput> {
  const { ctx, input } = env;
  const db = requireWritable(ctx.db);

  const existing = (
    await db
      .select({ id: customerGroups.id })
      .from(customerGroups)
      .where(
        and(
          eq(customerGroups.companyId, ctx.companyId),
          eq(customerGroups.id, input.id),
        ),
      )
      .limit(1)
      .for("update")
  )[0];
  if (existing === undefined) {
    throw new NotFoundError();
  }

  const deleted = (
    await db
      .delete(customerGroups)
      .where(
        and(
          eq(customerGroups.companyId, ctx.companyId),
          eq(customerGroups.id, input.id),
        ),
      )
      .returning({ id: customerGroups.id })
  )[0];
  if (deleted === undefined) {
    throw new CoreInvariantError(
      "customers.deleteGroup delete returned no row",
    );
  }

  ctx.log.info({ group_id: deleted.id }, "customers.deleteGroup deleted group");
  return { id: deleted.id };
}
