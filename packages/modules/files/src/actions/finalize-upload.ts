import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { fileAuditTarget } from "../services/file-audit-target.js";
import { finalizeStaffUpload } from "../services/finalize-upload.js";
import { finalizeUploadContract } from "./finalize-upload.contract.js";

export const finalizeUpload = implementAction(finalizeUploadContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("files.finalizeUpload expects staff");
    }
    return finalizeStaffUpload({ ctx, input });
  },
  auditTarget: fileAuditTarget,
});
