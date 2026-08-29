/**
 * Staff order list (SHO-209 / orders-T3). Mechanical choices the feature
 * card left unnamed — copy `catalog.listProducts`, do not invent a second
 * list shape:
 * - Pagination is a stable `(createdAt desc, id desc)` cursor, not offset.
 *   `limit` defaults to 20 and caps at 50.
 * - Cursor payload is `createdAtISO|id`.
 * - `status` defaults to `all`; `new`, `confirmed`, and `canceled` are
 *   explicit. No payment filter and no search.
 * - List rows are not the get view: header fields plus `itemCount` only.
 * - `timeout: 5000` matches the golden catalog reads.
 * - Company id is never input.
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

import { moneyWireSchema } from "../wire.contract.js";
import { orderStatusSchema } from "./order-view.contract.js";

export const LIST_ORDERS_DEFAULT_LIMIT = 20;
export const LIST_ORDERS_MAX_LIMIT = 50;
export const LIST_ORDERS_CURSOR_MAX = 80;

const listOrdersCursorPayloadSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
});

export function formatListOrdersCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}|${id}`;
}

export function parseListOrdersCursor(
  cursor: string,
): z.output<typeof listOrdersCursorPayloadSchema> | undefined {
  const separator = cursor.indexOf("|");
  if (separator <= 0 || separator !== cursor.lastIndexOf("|")) {
    return undefined;
  }
  const parsed = listOrdersCursorPayloadSchema.safeParse({
    createdAt: cursor.slice(0, separator),
    id: cursor.slice(separator + 1),
  });
  return parsed.success ? parsed.data : undefined;
}

export const listOrdersStatusFilterSchema = z.enum([
  "new",
  "confirmed",
  "canceled",
  "all",
]);

export const listOrdersInputSchema = z.object({
  status: listOrdersStatusFilterSchema.default("all"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(LIST_ORDERS_MAX_LIMIT)
    .default(LIST_ORDERS_DEFAULT_LIMIT),
  cursor: z
    .string()
    .min(1)
    .max(LIST_ORDERS_CURSOR_MAX)
    .refine((value) => parseListOrdersCursor(value) !== undefined, {
      message: "Invalid cursor",
    })
    .optional(),
});

export const listOrderRowSchema = z.object({
  orderId: z.uuid(),
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
    "List staff-intake orders in the staff member's active company. Default status all includes new, confirmed, and canceled; pass a CHECK status to filter. Paginate with a created-at/id cursor and a page size of at most 50. Each row includes orderId, nullable customerId, status, itemCount, total gross, currency, and createdAt — not the get view or line snapshots. Company id is never input. Does not search or filter by payment.",
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
  timeout: 5_000,
});
