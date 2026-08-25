import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { getStaffDownloadUrls } from "../services/get-download-url.js";
import { getDownloadUrlsContract } from "./get-download-urls.contract.js";

export const getDownloadUrls = implementAction(getDownloadUrlsContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("files.getDownloadUrls expects staff");
    }
    return getStaffDownloadUrls({ ctx, input });
  },
});
