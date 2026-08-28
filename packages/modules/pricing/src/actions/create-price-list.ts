import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { createStaffPriceList } from "../services/create-price-list.js";
import { priceListAuditTarget } from "../services/price-list-audit-target.js";
import { createPriceListContract } from "./create-price-list.contract.js";

export const createPriceList = implementAction(createPriceListContract, {
  handler: (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("pricing.createPriceList expects staff");
    }
    return createStaffPriceList({ ctx, input });
  },
  auditTarget: priceListAuditTarget,
});
