/**
 * Staff catalog list (SHO-135 / catalog-T7). Mechanical choices the feature
 * card left unnamed — copy them, do not invent a second list shape:
 * - Pagination is a stable `(createdAt desc, id desc)` cursor, not offset.
 *   `limit` defaults to 20 and caps at 50 (small-business catalog pages).
 * - `status` defaults to `active`; `archived` and `all` are explicit.
 * - Name search is optional, case-insensitive Drizzle `ilike`. LIKE
 *   metacharacters `%`, `_`, and `\\` in the query are stripped so they
 *   cannot widen or escape the match; a query that strips to empty
 *   returns no rows.
 * - Primary image is lowest `position`, then media id (same as
 *   `getProduct.imageFileIds[0]`).
 * - `timeout: 5000` matches the golden catalog reads.
 * - Money refine is local: keep the regex in lockstep with
 *   `packages/contract/src/client/money-wire.ts` until validation owns it.
 */
import { defineActionContract } from "@showzy/core/contract";
import { LIST_PRODUCTS_QUERY_MAX_LENGTH } from "@showzy/validation/catalog";
import { z } from "zod";

import { moneyWireSchema, productStatusSchema } from "../wire.contract.js";

export { LIST_PRODUCTS_QUERY_MAX_LENGTH };

export const LIST_PRODUCTS_DEFAULT_LIMIT = 20;
export const LIST_PRODUCTS_MAX_LIMIT = 50;

const listProductsCursorPayloadSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
});

export function formatListProductsCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}|${id}`;
}

export function parseListProductsCursor(
  cursor: string,
): z.output<typeof listProductsCursorPayloadSchema> | undefined {
  const separator = cursor.indexOf("|");
  if (separator <= 0 || separator !== cursor.lastIndexOf("|")) {
    return undefined;
  }
  const parsed = listProductsCursorPayloadSchema.safeParse({
    createdAt: cursor.slice(0, separator),
    id: cursor.slice(separator + 1),
  });
  return parsed.success ? parsed.data : undefined;
}

export const listProductsStatusFilterSchema = z.enum([
  "active",
  "archived",
  "all",
]);

export const listProductsInputSchema = z.object({
  status: listProductsStatusFilterSchema.default("active"),
  query: z
    .string()
    .trim()
    .min(1)
    .max(LIST_PRODUCTS_QUERY_MAX_LENGTH)
    .optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(LIST_PRODUCTS_MAX_LIMIT)
    .default(LIST_PRODUCTS_DEFAULT_LIMIT),
  cursor: z
    .string()
    .min(1)
    .max(80)
    .refine((value) => parseListProductsCursor(value) !== undefined, {
      message: "Invalid cursor",
    })
    .optional(),
});

export const listProductRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  basePriceMinor: moneyWireSchema,
  currency: z.string().length(3),
  status: productStatusSchema,
  variantCount: z.number().int().nonnegative(),
  primaryImageFileId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const listProductsOutputSchema = z.object({
  items: z.array(listProductRowSchema),
  nextCursor: z.string().min(1).nullable(),
});

export const listProductsContract = defineActionContract({
  name: "catalog.listProducts",
  description:
    "List products in the staff member's active company. Default to active products; pass status archived or all to include archived rows. Optional case-insensitive name search. Paginate with a created-at cursor and a page size of at most 50. Each row includes id, name, base price, currency, status, variant count, the primary image fileId (lowest position, if any), and timestamps. Clients fetch display URLs via files.getDownloadUrl — this action never returns URLs or object keys.",
  principal: "staff",
  transport: "client",
  input: listProductsInputSchema,
  output: listProductsOutputSchema,
  permissions: ["products:view"],
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
