import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { counterparties } from "@showzy/db/schema/customers";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import type {
  updateCounterpartyInputSchema,
  updateCounterpartyOutputSchema,
} from "../actions/update-counterparty.contract.js";
import { mapCounterpartyWriteError } from "./create-counterparty.js";
import {
  counterpartyReturning,
  requireOwnCustomer,
  storedCounterpartyFields,
  toCounterpartyView,
} from "./counterparty-view.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type UpdateInput = z.output<typeof updateCounterpartyInputSchema>;
type CounterpartyView = z.output<typeof updateCounterpartyOutputSchema>;

export async function updateStaffCounterparty(env: {
  readonly ctx: StaffCtx;
  readonly input: UpdateInput;
}): Promise<CounterpartyView> {
  const { ctx, input } = env;
  const db = requireWritable(ctx.db);
  const fields = storedCounterpartyFields(input);

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

  const linkedCustomer =
    fields.customerId === null
      ? null
      : await requireOwnCustomer(db, ctx.companyId, fields.customerId);

  try {
    const updated = (
      await db
        .update(counterparties)
        .set(fields)
        .where(
          and(
            eq(counterparties.companyId, ctx.companyId),
            eq(counterparties.id, input.id),
          ),
        )
        .returning(counterpartyReturning)
    )[0];
    if (updated === undefined) {
      throw new CoreInvariantError(
        "customers.updateCounterparty update returned no row",
      );
    }

    ctx.log.info(
      { counterparty_id: updated.id },
      "customers.updateCounterparty updated counterparty",
    );
    return toCounterpartyView(updated, linkedCustomer?.name ?? null);
  } catch (error) {
    throw mapCounterpartyWriteError(error);
  }
}
