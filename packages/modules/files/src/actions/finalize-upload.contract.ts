/**
 * Staff write: verify the uploaded object and mark the file ready.
 * Mechanical: `timeout: 15000` covers HEAD+GET+PutObject of up to 10 MiB plus
 * hashing. Missing or foreign fileIds are not-found (no existence leak).
 * Same-tenant objects that fail size, magic-byte, MIME, checksum, or prefix
 * checks fail validation. A second call on an already-ready file returns the
 * same view.
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

import { fileReadyViewSchema } from "./file-view.contract.js";

export const finalizeUploadInputSchema = z.object({
  fileId: z.uuid(),
});

export const finalizeUploadOutputSchema = fileReadyViewSchema;

export const finalizeUploadContract = defineActionContract({
  name: "files.finalizeUpload",
  description:
    "Finalize a pending catalog upload in the active company. Reads the handshake staging object, then verifies size, magic bytes against the declared MIME, SHA-256 checksum, and the server-derived key prefix, then writes those already-hashed bytes onto the durable catalog key. Executables, archives, and HEIC fail validation even when the declared MIME is an image. Missing or foreign-company files fail with not-found. A second finalize of a ready file returns the same view.",
  principal: "staff",
  transport: "client",
  input: finalizeUploadInputSchema,
  output: finalizeUploadOutputSchema,
  permissions: ["files:upload"],
  aiExposure: "exposed",
  risk: "write",
  requiresConfirmation: false,
  idempotent: true,
  emits: [],
  atomicCalls: [],
  atomicCallers: [],
  audit: true,
  timeout: 15_000,
});
