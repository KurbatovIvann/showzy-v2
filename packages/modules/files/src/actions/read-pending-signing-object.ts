import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { readStaffPendingSigningObject } from "../services/read-pending-signing-object.js";
import { readPendingSigningObjectContract } from "./read-pending-signing-object.contract.js";

export const readPendingSigningObject = implementAction(
  readPendingSigningObjectContract,
  {
    handler: async (input, ctx) => {
      if (ctx.principal !== "staff") {
        throw new CoreInvariantError(
          "files.readPendingSigningObject expects staff",
        );
      }
      return readStaffPendingSigningObject({ ctx, input });
    },
  },
);
