/**
 * UI draft Zod for the staff-intake order create form (SHO-379). Caps
 * match `orders.create`. This is not the action wire schema — the
 * planner emits `{ customer: { by: "id" }, items, comment? }` with milli.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  CREATE_ORDER_COMMENT_MAX,
  CREATE_ORDER_MAX_ITEMS,
} from "../shared/order-caps";

export { CREATE_ORDER_COMMENT_MAX, CREATE_ORDER_MAX_ITEMS };

export type CustomerErrorKey = "required";
export type ItemsErrorKey =
  | "required"
  | "duplicate"
  | "too_many"
  | "variant_required"
  | "no_active_variants";
export type CommentErrorKey = "too_long";

export type OrderFormFieldErrors = {
  readonly customer: CustomerErrorKey | null;
  readonly items: ItemsErrorKey | null;
  readonly comment: CommentErrorKey | null;
};

export function emptyFieldErrors(): OrderFormFieldErrors {
  return { customer: null, items: null, comment: null };
}

export function isCustomerErrorKey(value: string): value is CustomerErrorKey {
  return value === "required";
}

export function isItemsErrorKey(value: string): value is ItemsErrorKey {
  return (
    value === "required" ||
    value === "duplicate" ||
    value === "too_many" ||
    value === "variant_required" ||
    value === "no_active_variants"
  );
}

export function isCommentErrorKey(value: string): value is CommentErrorKey {
  return value === "too_long";
}

const QUANTITY_WIRE = /^[1-9][0-9]*$/;

export function orderLineIdentityKey(
  productId: string,
  variantId: string | null,
): string {
  return `${productId}\0${variantId ?? ""}`;
}

export const orderFormLineSchema = z.object({
  key: z.string().min(1),
  productId: z.uuid(),
  variantId: z.uuid().nullable(),
  productName: z.string(),
  variantName: z.string().nullable(),
  quantityMilli: z.string().refine((value) => QUANTITY_WIRE.test(value), {
    message: "invalid",
  }),
});

function itemsHaveUniqueIdentities(
  items: ReadonlyArray<{
    readonly productId: string;
    readonly variantId: string | null;
  }>,
): boolean {
  const seen = new Set<string>();
  for (const item of items) {
    const key = orderLineIdentityKey(item.productId, item.variantId);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
  }
  return true;
}

export const orderFormDraftSchema = z.object({
  customerId: z.string().refine((value) => value.length > 0, {
    message: "required",
  }),
  customerName: z.string(),
  comment: z
    .string()
    .refine((value) => value.length <= CREATE_ORDER_COMMENT_MAX, {
      message: "too_long",
    }),
  nextDraftSerial: z.number().int().positive(),
  items: z
    .array(orderFormLineSchema)
    .refine((items) => items.length >= 1, { message: "required" })
    .refine((items) => items.length <= CREATE_ORDER_MAX_ITEMS, {
      message: "too_many",
    })
    .refine((items) => itemsHaveUniqueIdentities(items), {
      message: "duplicate",
    }),
});

export const orderFormResolver = zodResolver(orderFormDraftSchema);

/**
 * Map UI-schema issues onto field copy keys. Schema `message` values
 * are keys, never user-facing copy.
 */
export function fieldErrorsFromDraftSchema(
  error: z.ZodError,
): OrderFormFieldErrors {
  let customer: CustomerErrorKey | null = null;
  let items: ItemsErrorKey | null = null;
  let comment: CommentErrorKey | null = null;
  for (const issue of error.issues) {
    const root = issue.path[0];
    if (root === "customerId" && isCustomerErrorKey(issue.message)) {
      customer = issue.message;
      continue;
    }
    if (root === "items" && isItemsErrorKey(issue.message)) {
      items = issue.message;
      continue;
    }
    if (root === "comment" && isCommentErrorKey(issue.message)) {
      comment = issue.message;
    }
  }
  return { customer, items, comment };
}
