/**
 * Staff internal read: short-lived signed GET for a ready document PDF.
 * Panel path — `documents:view`, not `files:view` (employees have no
 * files:view). Mechanical: `timeout: 5000` is one tenant-scoped lookup
 * plus local presign, copied from `files.getDownloadUrl`. Pending,
 * missing, foreign, and catalog files are not-found. Authorization is
 * rechecked when the URL is issued. The URL is not stored.
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

import { getDownloadUrlOutputSchema } from "./get-download-url.contract.js";

export const issueDocumentDownloadUrlInputSchema = z.object({
  fileId: z.uuid(),
});

export const issueDocumentDownloadUrlOutputSchema = getDownloadUrlOutputSchema;

export const issueDocumentDownloadUrlContract = defineActionContract({
  name: "files.issueDocumentDownloadUrl",
  description:
    "Return a short-lived signed GET URL for a ready private generated-document PDF in the active company. Panel path: requires documents:view, not files:view. Pending, missing, foreign-company, or catalog files fail with not-found. The URL uses Content-Disposition inline and Content-Type application/pdf; the filename is document.pdf. Clients never receive or choose the object key as a durable field. The URL is not stored.",
  principal: "staff",
  transport: "internal",
  input: issueDocumentDownloadUrlInputSchema,
  output: issueDocumentDownloadUrlOutputSchema,
  permissions: ["documents:view"],
  aiExposure: "internal",
  risk: "read",
  requiresConfirmation: false,
  idempotent: false,
  emits: [],
  atomicCalls: [],
  atomicCallers: [],
  audit: false,
  timeout: 5_000,
});
