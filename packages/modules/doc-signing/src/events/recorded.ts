import { defineEvent } from "@showzy/core";
import { z } from "zod";

export const docSigningRecorded = defineEvent({
  name: "docSigning.recorded",
  version: 1,
  scope: "tenant",
  payload: z.object({
    documentId: z.uuid(),
    signerRole: z.literal("supplier"),
    fileId: z.uuid(),
  }),
});
