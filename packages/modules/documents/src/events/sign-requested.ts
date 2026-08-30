import { defineEvent } from "@showzy/core";
import { z } from "zod";

export const documentsSignRequested = defineEvent({
  name: "documents.signRequested",
  version: 1,
  scope: "tenant",
  payload: z.object({
    documentId: z.uuid(),
  }),
});
