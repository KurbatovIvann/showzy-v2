import { getProductPricingFacts } from "@showzy/catalog";
import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { priceListAuditTarget } from "../services/price-list-audit-target.js";
import { setStaffPriceListEntries } from "../services/set-price-list-entries.js";
import { setPriceListEntriesContract } from "./set-price-list-entries.contract.js";

export const setPriceListEntries = implementAction(
  setPriceListEntriesContract,
  {
    handler: async (input, ctx) => {
      if (ctx.principal !== "staff") {
        throw new CoreInvariantError(
          "pricing.setPriceListEntries expects staff",
        );
      }

      await ctx.call(getProductPricingFacts, {
        items: input.entries.map((entry) =>
          entry.variantId === undefined
            ? { productId: entry.productId }
            : { productId: entry.productId, variantId: entry.variantId },
        ),
      });

      return setStaffPriceListEntries({ ctx, input });
    },
    auditTarget: priceListAuditTarget,
  },
);
