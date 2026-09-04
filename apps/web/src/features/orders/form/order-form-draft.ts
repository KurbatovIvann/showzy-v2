/**
 * Order create draft, dirty detection, and line helpers (SHO-379).
 * UI Zod lives in `order-form.schema.ts`; write planning is
 * `order-form-plan.ts`.
 */
import {
  CREATE_ORDER_MAX_ITEMS,
  DEFAULT_LINE_QUANTITY_MILLI,
  MAX_LINE_QUANTITY_UNITS,
  QUANTITY_MILLI_PER_UNIT,
} from "../shared/order-caps";
import {
  emptyFieldErrors,
  fieldErrorsFromDraftSchema,
  orderFormDraftSchema,
  orderLineIdentityKey,
  type OrderFormFieldErrors,
} from "./order-form.schema";

export {
  emptyFieldErrors,
  orderLineIdentityKey,
  type CommentErrorKey,
  type CustomerErrorKey,
  type ItemsErrorKey,
  type OrderFormFieldErrors,
} from "./order-form.schema";

export type OrderFormLineDraft = {
  key: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  quantityMilli: string;
};

export type OrderFormDraft = {
  customerId: string;
  customerName: string;
  comment: string;
  items: OrderFormLineDraft[];
  nextDraftSerial: number;
};

const QUANTITY_WIRE = /^[1-9][0-9]*$/;

export function emptyOrderFormDraft(): OrderFormDraft {
  return {
    customerId: "",
    customerName: "",
    comment: "",
    items: [],
    nextDraftSerial: 1,
  };
}

export function cloneOrderFormDraft(values: OrderFormDraft): OrderFormDraft {
  return {
    customerId: values.customerId,
    customerName: values.customerName,
    comment: values.comment,
    nextDraftSerial: values.nextDraftSerial,
    items: values.items.map((item) => ({
      key: item.key,
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName,
      variantName: item.variantName,
      quantityMilli: item.quantityMilli,
    })),
  };
}

export const LINE_QUANTITY_INPUT_MAX_DIGITS = String(
  MAX_LINE_QUANTITY_UNITS,
).length;

export function clampLineQuantityUnits(units: number): number {
  if (!Number.isInteger(units) || units < 1) {
    return 1;
  }
  return Math.min(MAX_LINE_QUANTITY_UNITS, units);
}

/** Keep only ASCII digits so the qty field can be typed, not only stepped. */
export function digitsFromQuantityInput(raw: string): string {
  return raw.replaceAll(/\D/g, "");
}

export function unitsFromQuantityInput(raw: string): number {
  const digits = digitsFromQuantityInput(raw);
  if (digits.length === 0) {
    return 1;
  }
  const value = BigInt(digits);
  if (value < 1n) {
    return 1;
  }
  if (value > BigInt(MAX_LINE_QUANTITY_UNITS)) {
    return MAX_LINE_QUANTITY_UNITS;
  }
  return Number(value);
}

export function quantityMilliFromUnits(units: number): string {
  return (
    BigInt(clampLineQuantityUnits(units)) * QUANTITY_MILLI_PER_UNIT
  ).toString(10);
}

/**
 * Whole-unit view of `quantityMilli`. Remainder ≥ 0.5 units rounds up
 * so hydrating `1500` (1.5) does not silently become 1.
 */
export function unitsFromQuantityMilli(wire: string): number {
  if (!QUANTITY_WIRE.test(wire)) {
    return 1;
  }
  const milli = BigInt(wire);
  const rounded =
    (milli + QUANTITY_MILLI_PER_UNIT / 2n) / QUANTITY_MILLI_PER_UNIT;
  if (rounded < 1n) {
    return 1;
  }
  if (rounded > BigInt(MAX_LINE_QUANTITY_UNITS)) {
    return MAX_LINE_QUANTITY_UNITS;
  }
  return Number(rounded);
}

export function stepQuantityMilli(wire: string, deltaUnits: number): string {
  return quantityMilliFromUnits(unitsFromQuantityMilli(wire) + deltaUnits);
}

export function formatOrderLineQuantity(wire: string): string {
  return String(unitsFromQuantityMilli(wire));
}

export type AddOrderLineInput = {
  readonly productId: string;
  readonly variantId: string | null;
  readonly productName: string;
  readonly variantName: string | null;
};

export type AddOrderLineResult =
  | {
      readonly ok: true;
      readonly draft: OrderFormDraft;
      readonly line: OrderFormLineDraft;
    }
  | { readonly ok: false; readonly reason: "duplicate" | "too_many" };

export function addOrderLine(
  draft: OrderFormDraft,
  input: AddOrderLineInput,
): AddOrderLineResult {
  if (draft.items.length >= CREATE_ORDER_MAX_ITEMS) {
    return { ok: false, reason: "too_many" };
  }
  const identity = orderLineIdentityKey(input.productId, input.variantId);
  if (
    draft.items.some(
      (item) =>
        orderLineIdentityKey(item.productId, item.variantId) === identity,
    )
  ) {
    return { ok: false, reason: "duplicate" };
  }
  const line: OrderFormLineDraft = {
    key: `draft-${String(draft.nextDraftSerial)}`,
    productId: input.productId,
    variantId: input.variantId,
    productName: input.productName,
    variantName: input.variantName,
    quantityMilli: DEFAULT_LINE_QUANTITY_MILLI,
  };
  return {
    ok: true,
    line,
    draft: {
      ...draft,
      nextDraftSerial: draft.nextDraftSerial + 1,
      items: [...draft.items, line],
    },
  };
}

export function removeOrderLine(
  draft: OrderFormDraft,
  key: string,
): OrderFormDraft {
  return {
    ...draft,
    items: draft.items.filter((item) => item.key !== key),
  };
}

export function setOrderLineQuantity(
  draft: OrderFormDraft,
  key: string,
  quantityMilli: string,
): OrderFormDraft {
  return {
    ...draft,
    items: draft.items.map((item) =>
      item.key === key ? { ...item, quantityMilli } : item,
    ),
  };
}

export function validateOrderForm(draft: OrderFormDraft): OrderFormFieldErrors {
  const parsed = orderFormDraftSchema.safeParse(draft);
  if (parsed.success) {
    return emptyFieldErrors();
  }
  return fieldErrorsFromDraftSchema(parsed.error);
}

export function isOrderFormValid(errors: OrderFormFieldErrors): boolean {
  return (
    errors.customer === null && errors.items === null && errors.comment === null
  );
}

export type OrderFormUiParse =
  | { readonly ok: true; readonly draft: OrderFormDraft }
  | { readonly ok: false; readonly errors: OrderFormFieldErrors };

export function parseOrderFormUiDraft(draft: OrderFormDraft): OrderFormUiParse {
  const errors = validateOrderForm(draft);
  if (!isOrderFormValid(errors)) {
    return { ok: false, errors };
  }
  return { ok: true, draft };
}
