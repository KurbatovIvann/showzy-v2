import type { ActionCtx } from "@showzy/core";
import { NotFoundError } from "@showzy/core/errors";
import { getPriceList } from "@showzy/pricing";

type StaffCtx = Extract<ActionCtx, { principal: "staff" }>;

/**
 * Prove `priceListId` belongs to this tenant via the pricing staff read
 * (ADR-0015). Missing, foreign, and unknown ids are the same not-found.
 * Omitted/null means inherit — callers store null, not a sentinel.
 * Inactive lists are valid assignments: `pricing.getPriceList` returns them.
 */
export async function resolveGroupPriceListId(
  ctx: StaffCtx,
  priceListId: string | null | undefined,
): Promise<string | null> {
  if (priceListId === null || priceListId === undefined) {
    return null;
  }

  try {
    await ctx.call(getPriceList, { id: priceListId });
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new NotFoundError();
    }
    throw error;
  }

  return priceListId;
}
