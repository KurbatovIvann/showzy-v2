/**
 * Internal catalog line resolve for `orders.create` (SHO-352 / ADR-0033).
 * Batch 1–100. Query-path is active only; id-path may target archived
 * rows. Variant query is scoped to the resolved product. Bounded DB
 * queries — no per-line SELECT or ctx.call. Output order matches input.
 *
 * Mechanical: `timeout: 5000` matches other catalog facts reads. Query
 * max 100. Conflict labels cap 5. Company id is never input.
 */
import { defineActionContract } from "@showzy/core/contract";
import { entityRefSchema } from "@showzy/validation/entity-ref";
import { z } from "zod";

export const RESOLVE_LINE_REFERENCES_MAX_LINES = 100;

const resolveLineItemSchema = z.strictObject({
  product: entityRefSchema,
  variant: entityRefSchema.optional(),
});

export const resolveLineReferencesInputSchema = z.strictObject({
  lines: z
    .array(resolveLineItemSchema)
    .min(1)
    .max(RESOLVE_LINE_REFERENCES_MAX_LINES),
});

export const resolvedLineReferenceSchema = z.strictObject({
  productId: z.uuid(),
  productName: z.string().min(1),
  variantId: z.uuid().nullable(),
  variantName: z.string().nullable(),
});

export const resolveLineReferencesOutputSchema = z.strictObject({
  lines: z.array(resolvedLineReferenceSchema).min(1),
});

export const resolveLineReferencesContract = defineActionContract({
  name: "catalog.resolveLineReferences",
  description:
    "Resolve a batch of order lines in the staff member's active company from product and optional variant ids or unique names. Query matches are active rows only. An id may still target an archived row. Variant queries are scoped to the resolved product. Zero matches are not-found. Ambiguous matches return conflict with at most five tenant-safe labels. Output preserves input order. Company id is never input.",
  principal: "staff",
  transport: "internal",
  input: resolveLineReferencesInputSchema,
  output: resolveLineReferencesOutputSchema,
  permissions: ["products:view"],
  aiExposure: "internal",
  risk: "read",
  requiresConfirmation: false,
  idempotent: false,
  emits: [],
  atomicCalls: [],
  atomicCallers: [],
  audit: false,
  timeout: 5_000,
});
