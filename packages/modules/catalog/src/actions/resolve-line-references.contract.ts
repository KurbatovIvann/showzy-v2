/**
 * Internal catalog line resolve for `orders.create` (SHO-352 / SHO-405 /
 * ADR-0033). Batch 1–100. Product and variant references by id on this
 * create-path are active only. Query-path is active only. Variant query is
 * scoped to the resolved product. A product with any variant rows (active
 * or archived) is variable: the parent is not sellable. Bounded DB
 * queries — no per-line SELECT or ctx.call. Output order matches input.
 *
 * Mechanical: `timeout: 5000` matches other catalog facts reads. Query
 * max 100. Product-name conflict labels cap 5 (`REFERENCE_CONFLICT_LABELS_MAX`).
 * Variant picker cap `VARIANT_SELECTION_OPTIONS_MAX` (20) is separate so a
 * normal 6-flavour product fits. Company id is never input.
 */
import { defineActionContract } from "@showzy/core/contract";
import { entityRefSchema } from "@showzy/validation/entity-ref";
import { z } from "zod";

export const RESOLVE_LINE_REFERENCES_MAX_LINES = 100;

/**
 * Bounded variant picker size for `variant_required` / `ambiguous` /
 * `unmatched_query`. Must fit a normal 6-flavour product. Not
 * `REFERENCE_CONFLICT_LABELS_MAX` (5), which would clip the sixth flavour.
 */
export const VARIANT_SELECTION_OPTIONS_MAX = 20;

export const VARIANT_AND_SELECTION_EXCLUSIVE_MESSAGE =
  "variant and variantSelection are mutually exclusive.";

export const variantSelectionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("unspecified") }),
  z.strictObject({ kind: z.literal("base") }),
  z.strictObject({
    kind: z.literal("reference"),
    ref: entityRefSchema,
  }),
]);

export type VariantSelection = z.output<typeof variantSelectionSchema>;

const resolveLineItemSchema = z
  .strictObject({
    product: entityRefSchema,
    variant: entityRefSchema.optional(),
    variantSelection: variantSelectionSchema.optional(),
  })
  .refine(
    (item) => item.variant === undefined || item.variantSelection === undefined,
    { message: VARIANT_AND_SELECTION_EXCLUSIVE_MESSAGE },
  );

export type ResolveLineItemInput = z.output<typeof resolveLineItemSchema>;

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
    "Resolve a batch of order lines in the staff member's active company from product and optional variant ids or unique names. variantSelection is unspecified, base, or a reference (id or query). Legacy variant EntityRef is mutually exclusive with variantSelection and maps to reference. Product and variant ids must be active. Query matches are active rows only. A product with any variant rows is variable: unspecified or base requires exactly one active variant and never sells the parent; archived-only variants are unavailable. Zero variant rows may resolve variantId null. Variant queries are scoped to the resolved product. Zero product matches are not-found. A variant id or query on a product with zero variant rows is not-found. Ambiguous product names return conflict with at most five tenant-safe labels. Variant selection conflicts return a structured catalog conflict (reason, server-side line target, options, optionsTruncated). Output preserves input order. Company id is never input.",
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
