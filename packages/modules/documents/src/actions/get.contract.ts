/**
 * Staff document get (SHO-233 / SHO-236 / SHO-256 / feature SHO-251). Copy
 * `orders.get`. Output is `documentViewSchema` plus `generation` from
 * nested `docGeneration.getArtifact`, the panel PDF URL from
 * `files.issueDocumentDownloadUrl` (`documents:view`, not `files:view`),
 * and `signing` from nested `docSigning.get`.
 *
 * Mechanical: `timeout: 15000` — nested getArtifact (2000) plus
 * issueDocumentDownloadUrl (5000) plus docSigning.get (5000). Input is a
 * strict object so `companyId` cannot be smuggled in (ADR-0013).
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

import {
  documentGenerationViewSchema,
  documentSigningViewSchema,
  documentViewSchema,
} from "./document-view.contract.js";

export const getDocumentInputSchema = z.strictObject({
  documentId: z.uuid(),
});

export const getDocumentOutputSchema = documentViewSchema.extend({
  generation: documentGenerationViewSchema,
  pdfDownloadUrl: z.url().nullable(),
  signing: documentSigningViewSchema,
});

export const getDocumentContract = defineActionContract({
  name: "documents.get",
  description:
    "Return a staff document, its seller/buyer snapshots, and immutable line copies in the active company. generation is the PDF job chip; the panel PDF download URL is issued for a ready artifact via files.issueDocumentDownloadUrl (documents:view, not files:view). signing is the nested supplier signing chip from docSigning.get. Missing or foreign-company documents fail with not-found. Company id is never input.",
  principal: "staff",
  transport: "client",
  input: getDocumentInputSchema,
  output: getDocumentOutputSchema,
  permissions: ["documents:view"],
  aiExposure: "exposed",
  risk: "read",
  requiresConfirmation: false,
  idempotent: false,
  emits: [],
  atomicCalls: [],
  atomicCallers: [],
  audit: false,
  timeout: 15_000,
});
