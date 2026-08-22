import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { fileAuditTarget } from "../services/file-audit-target.js";
import { sweepAbandonedUpload } from "../services/sweep-abandoned-uploads.js";
import { sweepAbandonedUploadsContract } from "./sweep-abandoned-uploads.contract.js";

export const sweepAbandonedUploads = implementAction(
  sweepAbandonedUploadsContract,
  {
    handler: async (input, ctx) => {
      if (ctx.principal !== "system" || ctx.scope !== "tenant") {
        throw new CoreInvariantError(
          "files.sweepAbandonedUploads expects tenant system",
        );
      }
      return sweepAbandonedUpload({ ctx, input });
    },
    auditTarget: fileAuditTarget,
  },
);
