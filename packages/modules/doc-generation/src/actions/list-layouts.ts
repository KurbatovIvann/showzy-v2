import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { listLayoutsContract } from "./list-layouts.contract.js";
import { listDocumentLayouts } from "../services/layouts.js";

export const listLayouts = implementAction(listLayoutsContract, {
  handler: (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("docGeneration.listLayouts expects staff");
    }
    return Promise.resolve({ layouts: [...listDocumentLayouts(input.type)] });
  },
});
