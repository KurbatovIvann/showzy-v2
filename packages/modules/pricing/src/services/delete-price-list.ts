import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { priceLists } from "@showzy/db/schema/pricing";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import type {
  deletePriceListInputSchema,
  deletePriceListOutputSchema,
} from "../actions/delete-price-list.contract.js";
import { requireLockedPriceListId } from "./locked-price-list.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type DeleteInput = z.output<typeof deletePriceListInputSchema>;
type DeleteOutput = z.output<typeof deletePriceListOutputSchema>;

export async function deleteStaffPriceList(env: {
  readonly ctx: StaffCtx;
  readonly input: DeleteInput;
}): Promise<DeleteOutput> {
  const { ctx, input } = env;
  const db = requireWritable(ctx.db);

  await requireLockedPriceListId(db, ctx.companyId, input.id);

  const deleted = (
    await db
      .delete(priceLists)
      .where(
        and(
          eq(priceLists.companyId, ctx.companyId),
          eq(priceLists.id, input.id),
        ),
      )
      .returning({ id: priceLists.id })
  )[0];
  if (deleted === undefined) {
    throw new CoreInvariantError(
      "pricing.deletePriceList delete returned no row",
    );
  }

  ctx.log.info(
    { price_list_id: deleted.id },
    "pricing.deletePriceList deleted price list",
  );
  return { id: deleted.id };
}
