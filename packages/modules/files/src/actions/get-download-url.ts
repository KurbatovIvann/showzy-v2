import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { getStaffDownloadUrl } from "../services/get-download-url.js";
import { getDownloadUrlContract } from "./get-download-url.contract.js";

export const getDownloadUrl = implementAction(getDownloadUrlContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("files.getDownloadUrl expects staff");
    }
    return getStaffDownloadUrl({ ctx, input });
  },
});
