import type { ActionCtx } from "@showzy/core";
import { customerGroups } from "@showzy/db/schema/customers";
import type { z } from "zod";

import type {
  deleteGroupInputSchema,
  deleteGroupOutputSchema,
} from "../actions/delete-group.contract.js";
import { deleteTenantRow, lockTenantRow } from "./tenant-row.js";
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

  await lockTenantRow(db, customerGroups, {
    companyId: ctx.companyId,
    id: input.id,
    columns: { id: customerGroups.id },
  });

  const deleted = await deleteTenantRow(db, customerGroups, {
    companyId: ctx.companyId,
    id: input.id,
    lostRowMessage: "customers.deleteGroup delete returned no row",
  });

  ctx.log.info({ group_id: deleted.id }, "customers.deleteGroup deleted group");
  return { id: deleted.id };
}
