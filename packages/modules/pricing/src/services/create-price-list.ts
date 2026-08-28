import { randomUUID } from "node:crypto";

import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { priceLists } from "@showzy/db/schema/pricing";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import type { createPriceListInputSchema } from "../actions/create-price-list.contract.js";
import { toPriceListView, type PriceListView } from "./price-list-view.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type CreateInput = z.output<typeof createPriceListInputSchema>;

const priceListReturning = {
  id: priceLists.id,
  name: priceLists.name,
  isDefault: priceLists.isDefault,
  isActive: priceLists.isActive,
  createdAt: priceLists.createdAt,
  updatedAt: priceLists.updatedAt,
} as const;

export async function createStaffPriceList(env: {
  readonly ctx: StaffCtx;
  readonly input: CreateInput;
}): Promise<PriceListView> {
  const { ctx, input } = env;
  const db = requireWritable(ctx.db);
  const isDefault = input.isDefault;
  const isActive = isDefault ? true : input.isActive;

  if (isDefault) {
    await db
      .update(priceLists)
      .set({ isDefault: false })
      .where(
        and(
          eq(priceLists.companyId, ctx.companyId),
          eq(priceLists.isDefault, true),
        ),
      );
  }

  const inserted = (
    await db
      .insert(priceLists)
      .values({
        id: randomUUID(),
        companyId: ctx.companyId,
        name: input.name,
        isDefault,
        isActive,
      })
      .returning(priceListReturning)
  )[0];
  if (inserted === undefined) {
    throw new CoreInvariantError(
      "pricing.createPriceList insert returned no row",
    );
  }

  ctx.log.info(
    { price_list_id: inserted.id },
    "pricing.createPriceList created price list",
  );

  return toPriceListView(inserted, 0);
}
