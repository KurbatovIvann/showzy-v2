import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { getAttachmentFacts } from "@showzy/files";

import { rejectNonImageAttachments } from "../services/image-mime.js";
import { productAuditTarget } from "../services/product-audit-target.js";
import { replaceProductImages } from "../services/set-product-images.js";
import { setProductImagesContract } from "./set-product-images.contract.js";

export const setProductImages = implementAction(setProductImagesContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("catalog.setProductImages expects staff");
    }

    // Empty list clears media; facts require min 1 id.
    if (input.fileIds.length > 0) {
      const facts = await ctx.call(getAttachmentFacts, {
        fileIds: input.fileIds,
      });
      if (facts.files.length !== input.fileIds.length) {
        throw new CoreInvariantError(
          "attachment facts count drifted from unique input",
        );
      }
      rejectNonImageAttachments(facts.files);
    }

    return replaceProductImages({ ctx, input });
  },
  auditTarget: productAuditTarget,
});
