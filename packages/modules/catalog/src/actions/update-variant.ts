import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { updateStaffVariant } from "../services/update-variant.js";
import { variantAuditTarget } from "../services/variant-audit-target.js";
import { updateVariantContract } from "./update-variant.contract.js";

export const updateVariant = implementAction(updateVariantContract, {
  handler: (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("catalog.updateVariant expects staff");
    }
    return updateStaffVariant({ ctx, input });
  },
  auditTarget: variantAuditTarget,
});
