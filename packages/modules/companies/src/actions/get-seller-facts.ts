import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { loadCompanyView } from "../services/company-view.js";
import { getSellerFactsContract } from "./get-seller-facts.contract.js";

export const getSellerFacts = implementAction(getSellerFactsContract, {
  handler: async (_input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("companies.getSellerFacts expects staff");
    }
    return loadCompanyView(ctx.db, ctx.companyId);
  },
});
