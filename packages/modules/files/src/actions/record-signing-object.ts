import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { fileAuditTarget } from "../services/file-audit-target.js";
import { recordStaffSigningObject } from "../services/record-signing-object.js";
import { recordSigningObjectContract } from "./record-signing-object.contract.js";

export const recordSigningObject = implementAction(
  recordSigningObjectContract,
  {
    handler: async (input, ctx) => {
      if (ctx.principal !== "staff") {
        throw new CoreInvariantError("files.recordSigningObject expects staff");
      }
      return recordStaffSigningObject({ ctx, input });
    },
    auditTarget: fileAuditTarget,
  },
);
