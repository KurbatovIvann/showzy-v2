/**
 * Staff client signing-state read (SHO-254 / feature SHO-251). Nested from
 * `documents.get` in SHO-256. Mechanical: the action name is
 * `docSigning.get` because core rejects a hyphen in the module segment
 * (package remains `@showzy/doc-signing`). `timeout: 15000` covers the
 * nested `documents.get` existence check (10000) plus own-table reads.
 *
 * SHO-256 must import this handler from `@showzy/doc-signing/get` (not the
 * barrel) and must drop the reverse `ctx.call(documents.get)` in this
 * handler — otherwise the call graph and ESM graph cycle.
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

export const signingStatusSchema = z.enum([
  "unsigned",
  "pending",
  "supplier_signed",
]);

export const getSigningInputSchema = z.strictObject({
  documentId: z.uuid(),
});

export const getSigningOutputSchema = z.object({
  status: signingStatusSchema,
  requestId: z.uuid().optional(),
  signedFileId: z.uuid().optional(),
});

export const getSigningContract = defineActionContract({
  name: "docSigning.get",
  description:
    "Return supplier signing state for a document in the active company: unsigned, a live pending request, or a recorded supplier ASiC. Used by the staff panel. Missing and foreign-company documents fail with not-found. Company id is never input.",
  principal: "staff",
  transport: "client",
  input: getSigningInputSchema,
  output: getSigningOutputSchema,
  permissions: ["documents:view"],
  aiExposure: "internal",
  risk: "read",
  requiresConfirmation: false,
  idempotent: false,
  emits: [],
  atomicCalls: [],
  atomicCallers: [],
  audit: false,
  timeout: 15_000,
});
