import { defineEvent } from "@showzy/core";
import { z } from "zod";

export const documentsCancelled = defineEvent({
  name: "documents.cancelled",
  version: 1,
  scope: "tenant",
  payload: z.object({
    documentId: z.uuid(),
    orderId: z.uuid(),
  }),
});
