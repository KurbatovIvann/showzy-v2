import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { getStaffDocumentDownloadUrl } from "../services/get-download-url.js";
import { issueDocumentDownloadUrlContract } from "./issue-document-download-url.contract.js";

export const issueDocumentDownloadUrl = implementAction(
  issueDocumentDownloadUrlContract,
  {
    handler: async (input, ctx) => {
      if (ctx.principal !== "staff") {
        throw new CoreInvariantError(
          "files.issueDocumentDownloadUrl expects staff",
        );
      }
      return getStaffDocumentDownloadUrl({ ctx, input });
    },
  },
);
