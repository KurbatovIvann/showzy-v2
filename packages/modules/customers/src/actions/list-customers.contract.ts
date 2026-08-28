/**
 * Staff customer list (SHO-175 / feature SHO-169). Mechanical choices the
 * feature card left unnamed — copy `catalog.listProducts` and
 * `customers.listGroups`, do not invent a second list shape:
 * - Pagination is a stable `(updated_at desc, id desc)` cursor, not
 *   offset. `limit` defaults to 20 and caps at 50.
 * - Cursor payload is `updatedAt|id` (ISO datetime, then uuid).
 * - `status` defaults to `active`; `archived` and `all` are explicit.
 * - Search is optional, max 100, case-insensitive Drizzle `ilike` on
 *   name OR phone OR email. LIKE metacharacters `%`, `_`, and `\\` in
 *   the query are stripped so they cannot widen or escape the match; a
 *   query that strips to empty returns no rows.
 * - Optional `groupId`: own-tenant membership only. Missing and
 *   other-tenant group ids yield an empty page (no existence leak), not
 *   not-found.
 * - Output rows are the shared `CustomerView` (includes `status` and
 *   `linkedCounterpartyCount`). No order-count field.
 * - `timeout: 5000` matches the golden catalog/group reads.
 * - No `rateLimit` override — staff default 120/min per user.
 * - `idempotent: false` like other staff reads: core.md §5 treats reads as
 *   naturally idempotent (no key, no storage). The ticket's `true` is
 *   that protocol, not the mutation idempotency suite.
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

import { customerViewSchema } from "./customer-view.contract.js";

export const LIST_CUSTOMERS_DEFAULT_LIMIT = 20;
export const LIST_CUSTOMERS_MAX_LIMIT = 50;
export const LIST_CUSTOMERS_SEARCH_MAX = 100;
export const LIST_CUSTOMERS_CURSOR_MAX = 80;

const listCustomersCursorPayloadSchema = z.object({
  updatedAt: z.iso.datetime(),
  id: z.uuid(),
});

export function formatListCustomersCursor(updatedAt: Date, id: string): string {
  return `${updatedAt.toISOString()}|${id}`;
}

export function parseListCustomersCursor(
  cursor: string,
): z.output<typeof listCustomersCursorPayloadSchema> | undefined {
  const separator = cursor.indexOf("|");
  if (separator <= 0 || separator !== cursor.lastIndexOf("|")) {
    return undefined;
  }
  const parsed = listCustomersCursorPayloadSchema.safeParse({
    updatedAt: cursor.slice(0, separator),
    id: cursor.slice(separator + 1),
  });
  return parsed.success ? parsed.data : undefined;
}

export const listCustomersStatusFilterSchema = z.enum([
  "active",
  "archived",
  "all",
]);

export const listCustomersInputSchema = z.object({
  status: listCustomersStatusFilterSchema.default("active"),
  search: z.string().trim().min(1).max(LIST_CUSTOMERS_SEARCH_MAX).optional(),
  groupId: z.uuid().optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(LIST_CUSTOMERS_MAX_LIMIT)
    .default(LIST_CUSTOMERS_DEFAULT_LIMIT),
  cursor: z
    .string()
    .min(1)
    .max(LIST_CUSTOMERS_CURSOR_MAX)
    .refine((value) => parseListCustomersCursor(value) !== undefined, {
      message: "Invalid cursor",
    })
    .optional(),
});

export const listCustomersOutputSchema = z.object({
  items: z.array(customerViewSchema),
  nextCursor: z.string().min(1).nullable(),
});

export const listCustomersContract = defineActionContract({
  name: "customers.listCustomers",
  description:
    "List CRM customers in the staff member's active company. Default to active customers; pass status archived or all to include archived rows. Optional case-insensitive search on name, phone, or email. Optional group filter returns an empty page for a missing or foreign group. Paginate with an updated-at/id cursor and a page size of at most 50. Each row is the customer view (id, name, contacts, notes, group and price-list assignments, status, linked counterparty count, timestamps). Company id is never input. Does not return order counts.",
  principal: "staff",
  transport: "client",
  input: listCustomersInputSchema,
  output: listCustomersOutputSchema,
  permissions: ["customers:view"],
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
