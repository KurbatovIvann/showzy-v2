import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { productAuditTarget } from "../services/product-audit-target.js";
import { updateStaffProduct } from "../services/update-product.js";
import { updateProductContract } from "./update-product.contract.js";

export const updateProduct = implementAction(updateProductContract, {
  handler: (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("catalog.updateProduct expects staff");
    }
    return updateStaffProduct({ ctx, input });
  },
  auditTarget: productAuditTarget,
});
