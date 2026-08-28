/**
 * Staff price-list list (SHO-171 / pricing-T3, widened SHO-184 / pricing-T4).
 * Mechanical choices the feature card left unnamed — copy
 * `catalog.listProducts`, do not invent a second list shape:
 * - Pagination is a stable `(isDefault desc, name asc, id asc)` cursor,
 *   not offset. `limit` defaults to 20 and caps at 50.
 * - Cursor payload is `0|id|name` / `1|id|name` so the name (which may
 *   contain `|`) is the remainder after the second separator.
 * - `name` is capped at 120, same as catalog / companies writes.
 * - Name search is optional, case-insensitive Drizzle `ilike`. LIKE
 *   metacharacters `%`, `_`, and `\\` in the query are stripped so they
 *   cannot widen or escape the match; a query that strips to empty
 *   returns no rows.
 * - `availability` defaults to `all` so inactive lists stay listed
 *   (customers `ctx.call` with `{}` / `{ limit }` must keep working).
 * - Additive `entryCount` is the row count of `price_list_entries`.
 *   Assignment counts are out of scope.
 * - `timeout: 5000` matches the golden pricing/catalog reads.
 * - No `rateLimit` override — staff default 120/min per user.
 * - `idempotent: false` like other staff reads: core.md treats reads as
 *   naturally idempotent (no key, no storage). The ticket's `true` is
 *   that protocol, not the mutation idempotency suite.
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

export const LIST_PRICE_LISTS_DEFAULT_LIMIT = 20;
export const LIST_PRICE_LISTS_MAX_LIMIT = 50;
export const LIST_PRICE_LISTS_QUERY_MAX = 100;
export const PRICE_LIST_NAME_MAX = 120;
export const LIST_PRICE_LISTS_CURSOR_MAX = 200;

const listPriceListsCursorPayloadSchema = z.object({
  isDefault: z.boolean(),
  id: z.uuid(),
  name: z.string().min(1).max(PRICE_LIST_NAME_MAX),
});

export function formatListPriceListsCursor(
  isDefault: boolean,
  id: string,
  name: string,
): string {
  return `${isDefault ? "1" : "0"}|${id}|${name}`;
}

export function parseListPriceListsCursor(
  cursor: string,
): z.output<typeof listPriceListsCursorPayloadSchema> | undefined {
  const first = cursor.indexOf("|");
  const second = cursor.indexOf("|", first + 1);
  if (first !== 1 || second <= first + 1) {
    return undefined;
  }
  const flag = cursor.slice(0, first);
  if (flag !== "0" && flag !== "1") {
    return undefined;
  }
  const parsed = listPriceListsCursorPayloadSchema.safeParse({
    isDefault: flag === "1",
    id: cursor.slice(first + 1, second),
    name: cursor.slice(second + 1),
  });
  return parsed.success ? parsed.data : undefined;
}

export const listPriceListsAvailabilitySchema = z.enum([
  "all",
  "active",
  "inactive",
]);

export const listPriceListsInputSchema = z.object({
  query: z.string().trim().min(1).max(LIST_PRICE_LISTS_QUERY_MAX).optional(),
  availability: listPriceListsAvailabilitySchema.default("all"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(LIST_PRICE_LISTS_MAX_LIMIT)
    .default(LIST_PRICE_LISTS_DEFAULT_LIMIT),
  cursor: z
    .string()
    .min(1)
    .max(LIST_PRICE_LISTS_CURSOR_MAX)
    .refine((value) => parseListPriceListsCursor(value) !== undefined, {
      message: "Invalid cursor",
    })
    .optional(),
});

export const listPriceListRowSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(PRICE_LIST_NAME_MAX),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  entryCount: z.number().int().nonnegative(),
});

export const listPriceListsOutputSchema = z.object({
  items: z.array(listPriceListRowSchema),
  nextCursor: z.string().min(1).nullable(),
});

export const listPriceListsContract = defineActionContract({
  name: "pricing.listPriceLists",
  description:
    "List price lists in the staff member's active company. Default availability all includes inactive lists; pass availability active or inactive to filter. Optional case-insensitive name search. Paginate with a default/name/id cursor and a page size of at most 50. Each row includes id, name, isDefault, isActive, and entryCount. Company id is never input. Does not return assignment counts.",
  principal: "staff",
  transport: "client",
  input: listPriceListsInputSchema,
  output: listPriceListsOutputSchema,
  permissions: ["pricing:view"],
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
