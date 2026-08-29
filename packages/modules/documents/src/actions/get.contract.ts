/**
 * Staff document get (SHO-233 / feature SHO-227). Copy `orders.get`. Output
 * is `documentViewSchema` plus explicit null `generation` and
 * `pdfDownloadUrl` this ticket (mechanical: SHO-236 fills those from
 * nested `doc-generation.getArtifact` + `files.issueDocumentDownloadUrl`;
 * this get must not query jobs or files tables).
 *
 * Mechanical: `timeout: 2000` — single-row header + lines, no nested
 * calls (same as `orders.get`).
 * Input is a strict object so `companyId` cannot be smuggled in
 * (ADR-0013).
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
  generation: documentGenerationViewSchema.nullable(),
  pdfDownloadUrl: z.url().nullable(),
});

export const getDocumentContract = defineActionContract({
  name: "documents.get",
  description:
    "Return a staff document, its seller/buyer snapshots, and immutable line copies in the active company. generation and the panel PDF download URL are null until document generation records an artifact. Missing or foreign-company documents fail with not-found. Company id is never input.",
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
  timeout: 2_000,
});
