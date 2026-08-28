import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { priceLists } from "@showzy/db/schema/pricing";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import type { setDefaultPriceListInputSchema } from "../actions/set-default-price-list.contract.js";
import { countPriceListEntries } from "./count-price-list-entries.js";
import {
  mapDefaultPriceListUniqueViolation,
  unsetCompanyDefaultLists,
} from "./default-swap.js";
import {
  priceListViewColumns,
  requireLockedPriceList,
} from "./locked-price-list.js";
import { toPriceListView, type PriceListView } from "./price-list-view.js";
import { requireWritable } from "./writable.js";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;
type SetDefaultInput = z.output<typeof setDefaultPriceListInputSchema>;

async function viewOf(
  ctx: StaffCtx,
  row: {
    readonly id: string;
    readonly name: string;
    readonly isDefault: boolean;
    readonly isActive: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;
  },
): Promise<PriceListView> {
  return toPriceListView(
    row,
    await countPriceListEntries(ctx.db, ctx.companyId, row.id),
  );
}

async function loadCompanyDefault(
  db: ReturnType<typeof requireWritable>,
  companyId: string,
) {
  return (
    await db
      .select(priceListViewColumns)
      .from(priceLists)
      .where(
        and(
          eq(priceLists.companyId, companyId),
          eq(priceLists.isDefault, true),
        ),
      )
      .limit(1)
      .for("update")
  )[0];
}

export async function setStaffDefaultPriceList(env: {
  readonly ctx: StaffCtx;
  readonly input: SetDefaultInput;
}): Promise<PriceListView | null> {
  const { ctx, input } = env;
  const db = requireWritable(ctx.db);

  if (input.priceListId === null) {
    const current = await loadCompanyDefault(db, ctx.companyId);
    if (current === undefined) {
      return null;
    }

    const updated = (
      await db
        .update(priceLists)
        .set({ isDefault: false })
        .where(
          and(
            eq(priceLists.companyId, ctx.companyId),
            eq(priceLists.id, current.id),
          ),
        )
        .returning(priceListViewColumns)
    )[0];
    if (updated === undefined) {
      throw new CoreInvariantError(
        "pricing.setDefaultPriceList clear returned no row",
      );
    }

    ctx.log.info(
      { price_list_id: updated.id },
      "pricing.setDefaultPriceList cleared company default",
    );
    return viewOf(ctx, updated);
  }

  const existing = await requireLockedPriceList(
    db,
    ctx.companyId,
    input.priceListId,
  );
  if (existing.isDefault && existing.isActive) {
    return viewOf(ctx, existing);
  }

  try {
    if (!existing.isDefault) {
      await unsetCompanyDefaultLists(db, ctx.companyId);
    }

    const updated = (
      await db
        .update(priceLists)
        .set({ isDefault: true, isActive: true })
        .where(
          and(
            eq(priceLists.companyId, ctx.companyId),
            eq(priceLists.id, existing.id),
          ),
        )
        .returning(priceListViewColumns)
    )[0];
    if (updated === undefined) {
      throw new CoreInvariantError(
        "pricing.setDefaultPriceList update returned no row",
      );
    }

    ctx.log.info(
      { price_list_id: updated.id },
      "pricing.setDefaultPriceList set company default",
    );
    return viewOf(ctx, updated);
  } catch (error) {
    throw mapDefaultPriceListUniqueViolation(error);
  }
}
