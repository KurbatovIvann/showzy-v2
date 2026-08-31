import type { ActionCtx } from "@showzy/core";
import { counterparties } from "@showzy/db/schema/customers";
import type { z } from "zod";

import type {
  deleteCounterpartyInputSchema,
  deleteCounterpartyOutputSchema,
} from "../actions/delete-counterparty.contract.js";
import { deleteTenantRow, lockTenantRow } from "./tenant-row.js";
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

  await lockTenantRow(db, counterparties, {
    companyId: ctx.companyId,
    id: input.id,
    columns: { id: counterparties.id },
  });

  const deleted = await deleteTenantRow(db, counterparties, {
    companyId: ctx.companyId,
    id: input.id,
    lostRowMessage: "customers.deleteCounterparty delete returned no row",
  });

  ctx.log.info(
    { counterparty_id: deleted.id },
    "customers.deleteCounterparty deleted counterparty",
  );
  return { id: deleted.id };
}
