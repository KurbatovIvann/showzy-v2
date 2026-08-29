import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { loadCompanyView } from "../services/company-view.js";
import { getCompanyContract } from "./get.contract.js";

export const getCompany = implementAction(getCompanyContract, {
  handler: async (_input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("companies.get expects staff");
    }
    return loadCompanyView(ctx.db, ctx.companyId);
  },
});
