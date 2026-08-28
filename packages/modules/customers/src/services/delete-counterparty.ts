import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { counterparties } from "@showzy/db/schema/customers";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import type {
  deleteCounterpartyInputSchema,
  deleteCounterpartyOutputSchema,
} from "../actions/delete-counterparty.contract.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type DeleteInput = z.output<typeof deleteCounterpartyInputSchema>;
type DeleteOutput = z.output<typeof deleteCounterpartyOutputSchema>;

export async function deleteStaffCounterparty(env: {
  readonly ctx: StaffCtx;
  readonly input: DeleteInput;
}): Promise<DeleteOutput> {
  const { ctx, input } = env;
  const db = requireWritable(ctx.db);

  const existing = (
    await db
      .select({ id: counterparties.id })
      .from(counterparties)
      .where(
        and(
          eq(counterparties.companyId, ctx.companyId),
          eq(counterparties.id, input.id),
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
      .delete(counterparties)
      .where(
        and(
          eq(counterparties.companyId, ctx.companyId),
          eq(counterparties.id, input.id),
        ),
      )
      .returning({ id: counterparties.id })
  )[0];
  if (deleted === undefined) {
    throw new CoreInvariantError(
      "customers.deleteCounterparty delete returned no row",
    );
  }

  ctx.log.info(
    { counterparty_id: deleted.id },
    "customers.deleteCounterparty deleted counterparty",
  );
  return { id: deleted.id };
}
