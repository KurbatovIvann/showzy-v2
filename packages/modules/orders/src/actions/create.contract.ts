/**
 * Reference-aware staff create (SHO-352 / ADR-0033). UI keeps `{ by: "id" }`
 * + milli; the assistant may use `{ by: "query" }` + decimal quantity.
 *
 * Mechanical choices the feature card left unnamed:
 * - `timeout: 20000` covers four nested `ctx.call`s
 *   (`customers.resolveCustomerReference` + `catalog.resolveLineReferences`
 *   + `companies.get` + `pricing.resolveProductPrices`, each 5000) sharing
 *   the remaining budget (unchanged from SHO-351's four nested reads).
 * - Compact output is id/number/customer snapshot/status/itemCount/totals/
 *   currency/createdAt. Full snapshot remains `orders.get`.
 * - Decimal quantity uses milli scale 3 (`1.5` → `1500`).
 * - Duplicate `(productId, variantId)` fails after canonical resolution as
 *   well as on raw EntityRef input (Zod refine).
 * - Comment is optional, max 2000; it is persisted but never bound as
 *   `auditSnapshot` and never placed on events.
 */
import { defineActionContract } from "@showzy/core/contract";
import { entityRefSchema } from "@showzy/validation/entity-ref";
import {
  DECIMAL_QUANTITY_MESSAGE,
  decimalQuantityToMilli,
  isDecimalQuantityString,
} from "@showzy/validation/money";
import { z } from "zod";

import { moneyWireSchema, quantityMilliWireSchema } from "../wire.contract.js";
import { listOrderCustomerSchema } from "./list.contract.js";
import { orderStatusSchema } from "./order-view.contract.js";

/** Line ceiling named on the feature card (stricter than catalog facts). */
export const CREATE_ORDER_MAX_ITEMS = 100;

export const CREATE_ORDER_COMMENT_MAX = 2000;

export const DUPLICATE_ORDER_LINE_MESSAGE =
  "Duplicate product/variant lines are not allowed.";

const createOrderDecimalSchema = z
  .string()
  .refine(
    (value) =>
      isDecimalQuantityString(value) &&
      decimalQuantityToMilli(value) !== undefined,
    { message: DECIMAL_QUANTITY_MESSAGE },
  );

export const createOrderQuantitySchema = z.union([
  z.strictObject({ milli: quantityMilliWireSchema }),
  z.strictObject({ decimal: createOrderDecimalSchema }),
]);

const createOrderItemSchema = z.strictObject({
  product: entityRefSchema,
  variant: entityRefSchema.optional(),
  quantity: createOrderQuantitySchema,
});

function entityRefKey(ref: z.output<typeof entityRefSchema>): string {
  return ref.by === "id" ? `id:${ref.id}` : `query:${ref.value}`;
}

function rawLineKey(item: {
  product: z.output<typeof entityRefSchema>;
  variant?: z.output<typeof entityRefSchema> | undefined;
}): string {
  return `${entityRefKey(item.product)}\0${
    item.variant === undefined ? "" : entityRefKey(item.variant)
  }`;
}

export const createOrderInputSchema = z.strictObject({
  customer: entityRefSchema,
  items: z
    .array(createOrderItemSchema)
    .min(1)
    .max(CREATE_ORDER_MAX_ITEMS)
    .refine(
      (items) => {
        const seen = new Set<string>();
        for (const item of items) {
          const key = rawLineKey(item);
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
        }
        return true;
      },
      { message: DUPLICATE_ORDER_LINE_MESSAGE },
    ),
  comment: z.string().max(CREATE_ORDER_COMMENT_MAX).optional(),
});

export const createOrderOutputSchema = z.strictObject({
  orderId: z.uuid(),
  orderNumber: z.string().min(1),
  customer: listOrderCustomerSchema,
  status: orderStatusSchema,
  itemCount: z.number().int().positive(),
  totalNetMinor: moneyWireSchema,
  totalTaxMinor: moneyWireSchema,
  totalGrossMinor: moneyWireSchema,
  currency: z.string().length(3),
  createdAt: z.iso.datetime(),
});

export type CreateOrderSummary = z.output<typeof createOrderOutputSchema>;

export const createOrderContract = defineActionContract({
  name: "orders.create",
  description:
    "Create a staff-intake order for a CRM customer in the active company. Customer and catalog lines accept a canonical id or a unique human query. Each line snapshots the resolved unit price (five-level chain), quantity (milli or decimal at scale 3), exempt/none money path, and catalog title. The whole request fails when any product, named variant, or customer is missing, ambiguous, or outside the company, when two lines resolve to the same product/variant, or when resolved currencies differ. Returns a compact summary; full snapshot is orders.get.",
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
