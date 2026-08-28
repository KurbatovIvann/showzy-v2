import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { priceListAuditTarget } from "../services/price-list-audit-target.js";
import { updateStaffPriceList } from "../services/update-price-list.js";
import { updatePriceListContract } from "./update-price-list.contract.js";

export const updatePriceList = implementAction(updatePriceListContract, {
  handler: (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("pricing.updatePriceList expects staff");
    }
    return updateStaffPriceList({ ctx, input });
  },
  auditTarget: priceListAuditTarget,
});
