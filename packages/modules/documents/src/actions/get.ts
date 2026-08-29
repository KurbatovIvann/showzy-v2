import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";

import { getDocumentContract } from "./get.contract.js";
import { loadStaffDocument } from "../services/load-document.js";

export const getDocument = implementAction(getDocumentContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("documents.get expects staff");
    }
    const view = await loadStaffDocument({
      db: ctx.db,
      companyId: ctx.companyId,
      documentId: input.documentId,
    });
    return {
      ...view,
      generation: null,
      pdfDownloadUrl: null,
    };
  },
});
