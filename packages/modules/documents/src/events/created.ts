import { defineEvent } from "@showzy/core";
import { z } from "zod";

import { documentTypeSchema } from "../actions/document-view.contract.js";

export const documentsCreated = defineEvent({
  name: "documents.created",
  version: 1,
  scope: "tenant",
  payload: z.object({
    documentId: z.uuid(),
    orderId: z.uuid(),
    type: documentTypeSchema,
    documentNumber: z.string().min(1),
  }),
});
