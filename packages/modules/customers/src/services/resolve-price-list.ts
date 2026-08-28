import type { ActionCtx } from "@showzy/core";
import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { listPriceLists } from "@showzy/pricing";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;

/** Matches `pricing.listPriceLists` max page size. */
const PRICE_LIST_LOOKUP_LIMIT = 50;
const PRICE_LIST_LOOKUP_MAX_PAGES = 20;

/**
 * Prove `priceListId` belongs to this tenant via the pricing staff read
 * (ADR-0015). Missing, foreign, and unknown ids are the same not-found.
 * Omitted/null means inherit — callers store null, not a sentinel.
 */
export async function resolveGroupPriceListId(
  ctx: StaffCtx,
  priceListId: string | null | undefined,
): Promise<string | null> {
  if (priceListId === null || priceListId === undefined) {
    return null;
  }

  let cursor: string | undefined;
  for (let page = 0; page < PRICE_LIST_LOOKUP_MAX_PAGES; page += 1) {
    const result = await ctx.call(
      listPriceLists,
      cursor === undefined
        ? { limit: PRICE_LIST_LOOKUP_LIMIT }
        : { limit: PRICE_LIST_LOOKUP_LIMIT, cursor },
    );
    if (result.items.some((item) => item.id === priceListId)) {
      return priceListId;
    }
    if (result.nextCursor === null) {
      throw new NotFoundError();
    }
    cursor = result.nextCursor;
  }

  throw new CoreInvariantError(
    "customers price-list lookup exhausted listPriceLists pages",
  );
}
