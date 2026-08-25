import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { createStaffVariant } from "../services/create-variant.js";
import { variantAuditTarget } from "../services/variant-audit-target.js";
import { createVariantContract } from "./create-variant.contract.js";

export const createVariant = implementAction(createVariantContract, {
  handler: (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("catalog.createVariant expects staff");
    }
    return createStaffVariant({ ctx, input });
  },
  auditTarget: variantAuditTarget,
});
