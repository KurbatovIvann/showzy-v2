import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { getStaffSigningDownloadUrl } from "../services/get-download-url.js";
import { issueShareSigningDownloadUrlContract } from "./issue-share-signing-download-url.contract.js";

export const issueShareSigningDownloadUrl = implementAction(
  issueShareSigningDownloadUrlContract,
  {
    handler: async (input, ctx) => {
      if (ctx.principal !== "staff") {
        throw new CoreInvariantError(
          "files.issueShareSigningDownloadUrl expects staff",
        );
      }
      return getStaffSigningDownloadUrl({ ctx, input });
    },
  },
);
