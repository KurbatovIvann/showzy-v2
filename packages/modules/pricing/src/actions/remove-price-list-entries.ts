import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { priceListAuditTarget } from "../services/price-list-audit-target.js";
import { removeStaffPriceListEntries } from "../services/remove-price-list-entries.js";
import { removePriceListEntriesContract } from "./remove-price-list-entries.contract.js";

export const removePriceListEntries = implementAction(
  removePriceListEntriesContract,
  {
    handler: (input, ctx) => {
      if (ctx.principal !== "staff") {
        throw new CoreInvariantError(
          "pricing.removePriceListEntries expects staff",
        );
      }
      return removeStaffPriceListEntries({ ctx, input });
    },
    auditTarget: priceListAuditTarget,
  },
);
