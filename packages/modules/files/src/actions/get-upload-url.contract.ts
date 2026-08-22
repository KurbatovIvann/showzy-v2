/**
 * Staff read: short-lived signed PUT for a pending catalog file.
 * Mechanical: `timeout: 5000` is one tenant-scoped lookup plus local presign.
 * Ready, missing, and foreign files are not-found. Authorization is
 * rechecked when the URL is issued. The URL is not stored.
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

export const getUploadUrlInputSchema = z.object({
  fileId: z.uuid(),
});

export const getUploadUrlOutputSchema = z.object({
  fileId: z.uuid(),
  uploadUrl: z.url(),
  expiresAt: z.iso.datetime(),
});

export const getUploadUrlContract = defineActionContract({
  name: "files.getUploadUrl",
  description:
    "Return a short-lived signed PUT URL for a pending private catalog file in the active company. Ready, missing, or foreign-company files fail with not-found. The handshake PUT targets {companyId}/uploads/{fileId} (derived in code, never stored). Clients never receive or choose the durable object key as a durable field. Call again if the previous PUT expired; do not mint a new requestUpload idempotency key.",
  principal: "staff",
  transport: "client",
  input: getUploadUrlInputSchema,
  output: getUploadUrlOutputSchema,
  permissions: ["files:upload"],
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
