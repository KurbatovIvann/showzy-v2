import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { getStaffSigningDownloadUrl } from "../services/get-download-url.js";
import { issueSigningDownloadUrlContract } from "./issue-signing-download-url.contract.js";

export const issueSigningDownloadUrl = implementAction(
  issueSigningDownloadUrlContract,
  {
    handler: async (input, ctx) => {
      if (ctx.principal !== "staff") {
        throw new CoreInvariantError(
          "files.issueSigningDownloadUrl expects staff",
        );
      }
      return getStaffSigningDownloadUrl({ ctx, input });
    },
  },
);
