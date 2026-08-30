import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { getStaffSigningUploadUrl } from "../services/get-upload-url.js";
import { getSigningUploadUrlContract } from "./get-signing-upload-url.contract.js";

export const getSigningUploadUrl = implementAction(
  getSigningUploadUrlContract,
  {
    handler: async (input, ctx) => {
      if (ctx.principal !== "staff") {
        throw new CoreInvariantError("files.getSigningUploadUrl expects staff");
      }
      return getStaffSigningUploadUrl({ ctx, input });
    },
  },
);
