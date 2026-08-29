/**
 * Public-target read of one shared document (SHO-235 / feature SHO-227).
 * Token in input is a selector, not a company grant (ADR-0013). Read-only
 * (ADR-0022) — not a share-principal write. Expired, revoked, or unknown
 * tokens are indistinguishable not-found. `pdfDownloadUrl` is the stored
 * pre-mint; null when missing or the signature expired. Public 30/min
 * IP-HMAC default. No audit, no events.
 *
 * Mechanical: `timeout: 2000` matches `documents.get`. `aiExposure:
 * "internal"` — capability URL, not an AI tool. Company id is never input.
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

import { documentViewSchema } from "./document-view.contract.js";

export const getSharedInputSchema = z.strictObject({
  token: z.string().min(1),
});

export const getSharedOutputSchema = documentViewSchema.extend({
  pdfDownloadUrl: z.url().nullable(),
});

export const getSharedContract = defineActionContract({
  name: "documents.getShared",
  description:
    "Return the published facts of one document for an unauthenticated page-token holder. The token is a selector, not a company grant. Expired, revoked, or unknown tokens fail with the same not-found. The PDF download URL is the stored short-lived signature; it is null when the PDF is not ready or the signature expired — the page token may still be valid. Company id is never input.",
  principal: "public",
  publicScope: "target",
  transport: "client",
  input: getSharedInputSchema,
  output: getSharedOutputSchema,
  permissions: [],
  aiExposure: "internal",
  risk: "read",
  requiresConfirmation: false,
  idempotent: false,
  emits: [],
  atomicCalls: [],
  atomicCallers: [],
  audit: false,
  timeout: 2_000,
});
