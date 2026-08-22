import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { getStaffUploadUrl } from "../services/get-upload-url.js";
import { getUploadUrlContract } from "./get-upload-url.contract.js";

export const getUploadUrl = implementAction(getUploadUrlContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("files.getUploadUrl expects staff");
    }
    return getStaffUploadUrl({ ctx, input });
  },
});
