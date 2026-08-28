import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { priceListAuditTarget } from "../services/price-list-audit-target.js";
import { setStaffPriceListActive } from "../services/set-price-list-active.js";
import { deactivatePriceListContract } from "./deactivate-price-list.contract.js";

export const deactivatePriceList = implementAction(
  deactivatePriceListContract,
  {
    handler: (input, ctx) => {
      if (ctx.principal !== "staff") {
        throw new CoreInvariantError(
          "pricing.deactivatePriceList expects staff",
        );
      }
      return setStaffPriceListActive({
        ctx,
        id: input.id,
        isActive: false,
      });
    },
    auditTarget: priceListAuditTarget,
  },
);
