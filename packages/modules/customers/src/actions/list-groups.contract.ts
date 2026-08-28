/**
 * Staff group list (SHO-177 / feature SHO-169). Mechanical choices the
 * feature card left unnamed — copy `catalog.listProducts` and
 * `pricing.listPriceLists`, do not invent a second list shape:
 * - Pagination is a stable `(sort_order asc, name asc, id asc)` cursor,
 *   not offset. `limit` defaults to 20 and caps at 50.
 * - Cursor payload is `sortOrder|id|name` so the name (which may contain
 *   `|`) is the remainder after the second separator.
 * - Name search is optional, case-insensitive Drizzle `ilike`, max 100.
 *   LIKE metacharacters `%`, `_`, and `\\` in the query are stripped so
 *   they cannot widen or escape the match; a query that strips to empty
 *   returns no rows. No color filter. No archived filter (groups are
 *   not archived).
 * - `timeout: 5000` matches the golden catalog/pricing reads.
 * - No `rateLimit` override — staff default 120/min per user.
 * - `idempotent: false` like other staff reads: core.md §5 treats reads as
 *   naturally idempotent (no key, no storage). The ticket's `true` is
 *   that protocol, not the mutation idempotency suite.
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

import { GROUP_NAME_MAX, groupViewSchema } from "./group-view.contract.js";

export const LIST_GROUPS_DEFAULT_LIMIT = 20;
export const LIST_GROUPS_MAX_LIMIT = 50;
export const LIST_GROUPS_SEARCH_MAX = 100;
export const LIST_GROUPS_CURSOR_MAX = 200;

const listGroupsCursorPayloadSchema = z.object({
  sortOrder: z.number().int(),
  id: z.uuid(),
  name: z.string().min(1).max(GROUP_NAME_MAX),
});

export function formatListGroupsCursor(
  sortOrder: number,
  id: string,
  name: string,
): string {
  return `${sortOrder.toString(10)}|${id}|${name}`;
}

export function parseListGroupsCursor(
  cursor: string,
): z.output<typeof listGroupsCursorPayloadSchema> | undefined {
  const first = cursor.indexOf("|");
  const second = cursor.indexOf("|", first + 1);
  if (first <= 0 || second <= first + 1) {
    return undefined;
  }
  const sortOrderRaw = cursor.slice(0, first);
  if (!/^-?\d+$/.test(sortOrderRaw)) {
    return undefined;
  }
  const parsed = listGroupsCursorPayloadSchema.safeParse({
    sortOrder: Number.parseInt(sortOrderRaw, 10),
    id: cursor.slice(first + 1, second),
    name: cursor.slice(second + 1),
  });
  return parsed.success ? parsed.data : undefined;
}

export const listGroupsInputSchema = z.object({
  search: z.string().trim().min(1).max(LIST_GROUPS_SEARCH_MAX).optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(LIST_GROUPS_MAX_LIMIT)
    .default(LIST_GROUPS_DEFAULT_LIMIT),
  cursor: z
    .string()
    .min(1)
    .max(LIST_GROUPS_CURSOR_MAX)
    .refine((value) => parseListGroupsCursor(value) !== undefined, {
      message: "Invalid cursor",
    })
    .optional(),
});

export const listGroupsOutputSchema = z.object({
  items: z.array(groupViewSchema),
  nextCursor: z.string().min(1).nullable(),
});

export const listGroupsContract = defineActionContract({
  name: "customers.listGroups",
  description:
    "List customer groups in the staff member's active company. Order by sort_order ascending, then name, then id. Optional case-insensitive name search. Paginate with a sort-order/name/id cursor and a page size of at most 50. Each row is the group view (id, name, slug, description, price-list assignment, active member count, timestamps). Company id is never input. Groups are not archived.",
  principal: "staff",
  transport: "client",
  input: listGroupsInputSchema,
  output: listGroupsOutputSchema,
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
