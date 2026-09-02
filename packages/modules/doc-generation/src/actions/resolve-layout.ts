import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { resolveLayoutContract } from "./resolve-layout.contract.js";
import { resolveDocumentLayout } from "../services/layouts.js";

export const resolveLayout = implementAction(resolveLayoutContract, {
  handler: (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("docGeneration.resolveLayout expects staff");
    }
    return Promise.resolve(resolveDocumentLayout(input));
  },
});
