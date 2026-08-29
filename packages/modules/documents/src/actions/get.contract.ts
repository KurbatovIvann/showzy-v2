/**
 * Staff document get (SHO-233 / SHO-236 / feature SHO-227). Copy
 * `orders.get`. Output is `documentViewSchema` plus `generation` from
 * nested `docGeneration.getArtifact` and the panel PDF URL from
 * `files.issueDocumentDownloadUrl` (`documents:view`, not `files:view`).
 *
 * Mechanical: `timeout: 10000` — nested getArtifact (2000) plus
 * issueDocumentDownloadUrl (5000). Input is a strict object so
 * `companyId` cannot be smuggled in (ADR-0013).
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

import {
  documentGenerationViewSchema,
  documentViewSchema,
} from "./document-view.contract.js";

export const getDocumentInputSchema = z.strictObject({
  documentId: z.uuid(),
});

export const getDocumentOutputSchema = documentViewSchema.extend({
  generation: documentGenerationViewSchema,
  pdfDownloadUrl: z.url().nullable(),
});

export const getDocumentContract = defineActionContract({
  name: "documents.get",
  description:
    "Return a staff document, its seller/buyer snapshots, and immutable line copies in the active company. generation is the PDF job chip; the panel PDF download URL is issued for a ready artifact via files.issueDocumentDownloadUrl (documents:view, not files:view). Missing or foreign-company documents fail with not-found. Company id is never input.",
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
  timeout: 10_000,
});
