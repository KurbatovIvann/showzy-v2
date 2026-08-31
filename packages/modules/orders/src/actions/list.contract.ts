/**
 * Staff order list (SHO-209 / orders-T3, SHO-240 query + orderNumber).
 * Mechanical choices the feature card left unnamed — copy
 * `catalog.listProducts` / `customers.listCustomers`, do not invent a
 * second list shape:
 * - Pagination is a stable `(createdAt desc, id desc)` cursor, not offset.
 *   `limit` defaults to 20 and caps at 50.
 * - Cursor payload is `createdAtISO|id`.
 * - `status` defaults to `all`; `new`, `confirmed`, and `canceled` are
 *   explicit. No payment filter.
 * - Optional `query`: trim, min 1, max `LIST_ORDERS_QUERY_MAX` (100, same
 *   cap as catalog/customers list search). LIKE metacharacters `%`, `_`,
 *   and `\\` are stripped so they cannot widen the match; a query that
 *   strips to empty returns no rows.
 * - Search matches the text `order_number` with a case-insensitive
 *   contains (optional leading `#` stripped) OR CRM name/phone/email
 *   via `ctx.call` `customers.listCustomers`.
 * - Customer-id pages drain up to `LIST_ORDERS_CUSTOMER_SEARCH_MAX_PAGES`
 *   of `LIST_ORDERS_CUSTOMER_SEARCH_PAGE_SIZE` (500 ids). Named cap.
 * - List rows are not the get view: header fields plus `itemCount` only.
 * - `timeout: 10000` covers nested `customers.listCustomers` (5000) plus
 *   the orders page on the remaining budget (mechanical; was 5000).
 * - Company id is never input.
 */
import { defineActionContract } from "@showzy/core/contract";
import {
  createCursorCodec,
  listCursorInput,
  listLimitInput,
  listSearchInput,
} from "@showzy/validation/pagination";
import { z } from "zod";

import { moneyWireSchema } from "../wire.contract.js";
import { orderStatusSchema } from "./order-view.contract.js";

export const LIST_ORDERS_DEFAULT_LIMIT = 20;
export const LIST_ORDERS_MAX_LIMIT = 50;
export const LIST_ORDERS_CURSOR_MAX = 80;
/** Local cap (SHO-240): same 100 as catalog/customers list search. */
export const LIST_ORDERS_QUERY_MAX = 100;
/** Drain cap for nested `customers.listCustomers` pages (SHO-240). */
export const LIST_ORDERS_CUSTOMER_SEARCH_PAGE_SIZE = 50;
export const LIST_ORDERS_CUSTOMER_SEARCH_MAX_PAGES = 10;

const listOrdersCursor = createCursorCodec({
  payload: z.object({
    createdAt: z.iso.datetime(),
    id: z.uuid(),
  }),
  fields: [
    { key: "createdAt", kind: "isoDatetime" },
    { key: "id", kind: "uuid" },
  ],
});

export function formatListOrdersCursor(createdAt: Date, id: string): string {
  return listOrdersCursor.encode({ createdAt, id });
}

export function parseListOrdersCursor(
  cursor: string,
): { createdAt: string; id: string } | undefined {
  return listOrdersCursor.decode(cursor);
}

export const listOrdersStatusFilterSchema = z.enum([
  "new",
  "confirmed",
  "canceled",
  "all",
]);

export const listOrdersInputSchema = z.object({
  status: listOrdersStatusFilterSchema.default("all"),
  query: listSearchInput(LIST_ORDERS_QUERY_MAX),
  limit: listLimitInput(LIST_ORDERS_MAX_LIMIT, LIST_ORDERS_DEFAULT_LIMIT),
  cursor: listCursorInput(parseListOrdersCursor, LIST_ORDERS_CURSOR_MAX),
});

export const listOrderRowSchema = z.object({
  orderId: z.uuid(),
  orderNumber: z.string().min(1),
  customerId: z.uuid().nullable(),
  status: orderStatusSchema,
  itemCount: z.number().int().nonnegative(),
  totalGrossMinor: moneyWireSchema,
  currency: z.string().length(3),
  createdAt: z.iso.datetime(),
});

export const listOrdersOutputSchema = z.object({
  items: z.array(listOrderRowSchema),
  nextCursor: z.string().min(1).nullable(),
});

export const listOrdersContract = defineActionContract({
  name: "orders.list",
  description:
    "List staff-intake orders in the staff member's active company. Default status all includes new, confirmed, and canceled; pass a CHECK status to filter. Optional query matches the text order number with a case-insensitive contains (optional leading #) or CRM customer name, phone, or email. Paginate with a created-at/id cursor and a page size of at most 50. Each row includes orderId, orderNumber, nullable customerId, status, itemCount, total gross, currency, and createdAt — not the get view or line snapshots. Company id is never input. Does not filter by payment.",
  principal: "staff",
  transport: "client",
  input: listOrdersInputSchema,
  output: listOrdersOutputSchema,
  permissions: ["orders:view"],
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
