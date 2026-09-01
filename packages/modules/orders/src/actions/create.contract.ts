/**
 * Golden write-action contract (SHO-92 / orders-T2). Later Executors copy
 * this file's shape. Mechanical choices the feature card left unnamed:
 * - `timeout: 20000` covers four nested `ctx.call`s (`companies.get` +
 *   catalog order facts + pricing resolve + `customers.getCustomer` for
 *   `customer_name_snapshot`, each 5000) sharing the remaining budget
 *   (SHO-351 mechanical amend; was 15000 for three calls).
 * - Output is the created order view (same shape as `orders.get`) so the
 *   client has snapshots without a second round-trip.
 * - `quantityMilli` is a canonical positive integer string (scale 3).
 * - Duplicate `(productId, variantId)` lines fail Zod refine (ValidationError).
 * - Comment is optional, max 2000; it is returned on the order view but
 *   never bound as `auditSnapshot` and never placed on events.
 */
import { defineActionContract } from "@showzy/core/contract";
import { z } from "zod";

import { orderViewSchema } from "./order-view.contract.js";
import { quantityMilliWireSchema } from "../wire.contract.js";

/** Line ceiling named on the feature card (stricter than catalog facts). */
export const CREATE_ORDER_MAX_ITEMS = 100;

export const CREATE_ORDER_COMMENT_MAX = 2000;

const createOrderItemSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid().optional(),
  quantityMilli: quantityMilliWireSchema,
});

function lineKey(item: {
  productId: string;
  variantId?: string | undefined;
}): string {
  return `${item.productId}\0${item.variantId ?? ""}`;
}

export const createOrderInputSchema = z.object({
  customerId: z.uuid(),
  items: z
    .array(createOrderItemSchema)
    .min(1)
    .max(CREATE_ORDER_MAX_ITEMS)
    .refine(
      (items) => {
        const seen = new Set<string>();
        for (const item of items) {
          const key = lineKey(item);
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
        }
        return true;
      },
      { message: "Duplicate product/variant lines are not allowed." },
    ),
  comment: z.string().max(CREATE_ORDER_COMMENT_MAX).optional(),
});

export const createOrderOutputSchema = orderViewSchema;

export const createOrderContract = defineActionContract({
  name: "orders.create",
  description:
    "Create a staff-intake order for an existing CRM customer in the active company. Each line snapshots the resolved unit price (five-level chain), quantity, exempt/none money path, and catalog title. The whole request fails when any product, named variant, or customer is missing or outside the company, when two lines name the same product/variant, or when resolved currencies differ.",
  principal: "staff",
  transport: "client",
  input: createOrderInputSchema,
  output: createOrderOutputSchema,
  permissions: ["orders:create"],
  aiExposure: "exposed",
  risk: "write",
  requiresConfirmation: false,
  idempotent: true,
  emits: ["orders.created"],
  atomicCalls: [],
  atomicCallers: [],
  audit: true,
  timeout: 20_000,
});
