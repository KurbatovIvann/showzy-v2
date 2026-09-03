/**
 * Order create write planner (SHO-379). UI parse happens first via
 * `parseOrderFormUiDraft`; this file turns a valid draft into one
 * `orders.create` write. Wire is `{ customer: { by: "id" }, items, comment? }`
 * with milli quantities only — no prices, payment, or delivery.
 */
import type { WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import type { CreateOrderPayload } from "../api/create";
import {
  isOrderFormValid,
  parseOrderFormUiDraft,
  validateOrderForm,
  type OrderFormDraft,
  type OrderFormFieldErrors,
} from "./order-form-draft";

export type { CreateOrderPayload };

export type OrderFormWrite = {
  readonly kind: "createOrder";
  readonly input: CreateOrderPayload;
};

export type OrderFormSavePlan =
  | { readonly kind: "invalid"; readonly errors: OrderFormFieldErrors }
  | { readonly kind: "retry" }
  | { readonly kind: "write"; readonly write: OrderFormWrite };

const RETRYABLE_FAILURE: ReadonlySet<QueryFailureKind> = new Set([
  "network",
  "offline",
  "timeout",
  "rate_limited",
  "internal",
]);

const RETRYABLE_WIRE: ReadonlySet<WireErrorCode> = new Set([
  "RETRY_IN_PROGRESS",
  "IDEMPOTENCY_CONFLICT",
]);

function wireItems(draft: OrderFormDraft): CreateOrderPayload["items"] {
  return draft.items.map((item) => {
    if (item.variantId === null) {
      return {
        product: { by: "id" as const, id: item.productId },
        quantity: { milli: item.quantityMilli },
      };
    }
    return {
      product: { by: "id" as const, id: item.productId },
      variant: { by: "id" as const, id: item.variantId },
      quantity: { milli: item.quantityMilli },
    };
  });
}

export function createOrderPayload(
  draft: OrderFormDraft,
): CreateOrderPayload | null {
  const parsed = parseOrderFormUiDraft(draft);
  if (!parsed.ok) {
    return null;
  }
  const comment = parsed.draft.comment.trim();
  const items = wireItems(parsed.draft);
  if (comment.length === 0) {
    return {
      customer: { by: "id", id: parsed.draft.customerId },
      items,
    };
  }
  return {
    customer: { by: "id", id: parsed.draft.customerId },
    items,
    comment,
  };
}

export function writesEqual(
  left: OrderFormWrite,
  right: OrderFormWrite,
): boolean {
  return JSON.stringify(left.input) === JSON.stringify(right.input);
}

export function isOrderFormRetryable(
  kind: QueryFailureKind | null,
  wireCode: WireErrorCode | null = null,
): boolean {
  if (wireCode !== null && RETRYABLE_WIRE.has(wireCode)) {
    return true;
  }
  return kind !== null && RETRYABLE_FAILURE.has(kind);
}

export function planOrderFormSave(args: {
  readonly draft: OrderFormDraft;
  readonly lastWrite: OrderFormWrite | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly lastWireCode?: WireErrorCode | null;
}): OrderFormSavePlan {
  const errors = validateOrderForm(args.draft);
  if (!isOrderFormValid(errors)) {
    return { kind: "invalid", errors };
  }
  const input = createOrderPayload(args.draft);
  if (input === null) {
    return { kind: "invalid", errors };
  }
  const write: OrderFormWrite = { kind: "createOrder", input };
  const retryable = isOrderFormRetryable(
    args.lastFailureKind,
    args.lastWireCode ?? null,
  );
  if (
    args.lastWrite !== null &&
    writesEqual(args.lastWrite, write) &&
    retryable
  ) {
    return { kind: "retry" };
  }
  return { kind: "write", write };
}

export function parseThenPlanOrderFormSave(args: {
  readonly draft: OrderFormDraft;
  readonly lastWrite: OrderFormWrite | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly lastWireCode?: WireErrorCode | null;
}): OrderFormSavePlan {
  const parsed = parseOrderFormUiDraft(args.draft);
  if (!parsed.ok) {
    return { kind: "invalid", errors: parsed.errors };
  }
  return planOrderFormSave({ ...args, draft: parsed.draft });
}
