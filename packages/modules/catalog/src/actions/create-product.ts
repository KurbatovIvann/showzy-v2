import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { createStaffProduct } from "../services/create-product.js";
import { productAuditTarget } from "../services/product-audit-target.js";
import { createProductContract } from "./create-product.contract.js";

export const createProduct = implementAction(createProductContract, {
  handler: (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("catalog.createProduct expects staff");
    }
    return createStaffProduct({ ctx, input });
  },
  auditTarget: productAuditTarget,
});
