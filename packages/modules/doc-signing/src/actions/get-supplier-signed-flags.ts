import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { signingSignatures } from "@showzy/db/schema/doc-signing";
import { uniqueIds } from "@showzy/module-kit/unique-ids";
import { and, eq, inArray } from "drizzle-orm";

import { getSupplierSignedFlagsContract } from "./get-supplier-signed-flags.contract.js";

export const getSupplierSignedFlags = implementAction(
  getSupplierSignedFlagsContract,
  {
    handler: async (input, ctx) => {
      if (ctx.principal !== "staff") {
        throw new CoreInvariantError(
          "docSigning.getSupplierSignedFlags expects staff",
        );
      }

      const documentIds = uniqueIds(input.documentIds);
      if (documentIds.length === 0) {
        return { flags: [] };
      }

      const rows = await ctx.db
        .select({ documentId: signingSignatures.documentId })
        .from(signingSignatures)
        .where(
          and(
            eq(signingSignatures.companyId, ctx.companyId),
            eq(signingSignatures.signerRole, "supplier"),
            inArray(signingSignatures.documentId, documentIds),
          ),
        );
      const signed = new Set(rows.map((row) => row.documentId));
      return {
        flags: documentIds.map((documentId) => ({
          documentId,
          supplierSigned: signed.has(documentId),
        })),
      };
    },
  },
);
