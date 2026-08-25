/**
 * Staff read: short-lived signed GETs for a batch of ready catalog files.
 * Mechanical: `timeout: 5000` is one tenant-scoped lookup plus local
 * presigns (max `ATTACHMENT_FACTS_MAX_IDS`). Pending, missing, and
 * foreign files fail the whole batch with not-found (same as
 * `files.getAttachmentFacts`). Authorization is rechecked when URLs are
 * issued. URLs are not stored. Duplicate ids collapse to first-seen
 * unique order (same batch convention as attachment facts).
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

import { ATTACHMENT_FACTS_MAX_IDS } from "./get-attachment-facts.contract.js";
import { getDownloadUrlOutputSchema } from "./get-download-url.contract.js";

export const getDownloadUrlsInputSchema = z.object({
  fileIds: z.array(z.uuid()).min(1).max(ATTACHMENT_FACTS_MAX_IDS),
});

export const getDownloadUrlsOutputSchema = z.object({
  files: z.array(getDownloadUrlOutputSchema),
});

export const getDownloadUrlsContract = defineActionContract({
  name: "files.getDownloadUrls",
  description:
    "Return short-lived signed GET URLs for a batch of ready private catalog files in the active company. Input is fileIds (min 1, max 50). Output is { files: [{ fileId, downloadUrl, expiresAt }] } in first-seen unique order. The whole batch fails with not-found when any id is missing, still pending, or outside the company. Each URL uses a disposition-safe attachment filename derived from the stored MIME type; clients never receive or choose the object key as a durable field.",
  principal: "staff",
  transport: "client",
  input: getDownloadUrlsInputSchema,
  output: getDownloadUrlsOutputSchema,
  permissions: ["files:view"],
  aiExposure: "exposed",
  risk: "read",
  requiresConfirmation: false,
  idempotent: false,
  emits: [],
  atomicCalls: [],
  atomicCallers: [],
  audit: false,
  timeout: 5_000,
});
