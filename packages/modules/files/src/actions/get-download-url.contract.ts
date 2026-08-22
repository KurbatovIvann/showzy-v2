/**
 * Staff read: short-lived signed GET for a ready catalog file.
 * Mechanical: `timeout: 5000` is one tenant-scoped lookup plus local presign.
 * Pending, missing, and foreign files are not-found. Authorization is
 * rechecked when the URL is issued. The URL is not stored.
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

export const getDownloadUrlInputSchema = z.object({
  fileId: z.uuid(),
});

export const getDownloadUrlOutputSchema = z.object({
  fileId: z.uuid(),
  downloadUrl: z.url(),
  expiresAt: z.iso.datetime(),
});

export const getDownloadUrlContract = defineActionContract({
  name: "files.getDownloadUrl",
  description:
    "Return a short-lived signed GET URL for a ready private catalog file in the active company. Pending, missing, or foreign-company files fail with not-found. The URL uses a disposition-safe attachment filename derived from the stored MIME type; clients never receive or choose the object key as a durable field.",
  principal: "staff",
  transport: "client",
  input: getDownloadUrlInputSchema,
  output: getDownloadUrlOutputSchema,
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
