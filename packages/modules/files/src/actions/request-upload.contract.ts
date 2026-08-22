/**
 * Staff write: create a pending catalog file and return a short-lived signed
 * PUT. Mechanical: `timeout: 5000` covers one insert plus local presign.
 * The signed URL is a live response field, not a column.
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

import {
  checksumSha256Schema,
  fileMimeTypeSchema,
  filePurposeSchema,
  uploadByteSizeSchema,
} from "../wire.contract.js";

export const requestUploadInputSchema = z.object({
  purpose: filePurposeSchema,
  mimeType: fileMimeTypeSchema,
  byteSize: uploadByteSizeSchema,
  checksumSha256: checksumSha256Schema,
});

export const requestUploadOutputSchema = z.object({
  fileId: z.uuid(),
  uploadUrl: z.url(),
  expiresAt: z.iso.datetime(),
});

export const requestUploadContract = defineActionContract({
  name: "files.requestUpload",
  description:
    "Create a pending private catalog file in the active company and return a short-lived signed PUT URL. The object key is server-derived ({companyId}/catalog/{fileId}); clients never supply a key, URL, or bucket. JPEG, PNG, and WebP up to 10 MiB are accepted. HEIC and other types fail validation. The signed URL is not stored on the file row.",
  principal: "staff",
  transport: "client",
  input: requestUploadInputSchema,
  output: requestUploadOutputSchema,
  permissions: ["files:upload"],
  aiExposure: "exposed",
  risk: "write",
  requiresConfirmation: false,
  idempotent: true,
  emits: [],
  atomicCalls: [],
  atomicCallers: [],
  audit: true,
  timeout: 5_000,
});
