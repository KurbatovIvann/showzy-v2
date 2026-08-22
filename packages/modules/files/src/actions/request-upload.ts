import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { fileAuditTarget } from "../services/file-audit-target.js";
import { requestStaffUpload } from "../services/request-upload.js";
import { requestUploadContract } from "./request-upload.contract.js";

export const requestUpload = implementAction(requestUploadContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("files.requestUpload expects staff");
    }
    return requestStaffUpload({ ctx, input });
  },
  auditTarget: fileAuditTarget,
});
