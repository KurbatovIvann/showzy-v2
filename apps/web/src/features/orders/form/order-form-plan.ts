/**
 * Order create write planner (SHO-379 / SHO-408). UI parse happens first
 * via `parseOrderFormUiDraft`; this file turns a valid draft into one
 * `orders.create` write. Wire is `{ customer: { by: "id" }, items, comment? }`
 * with milli quantities only — no prices, payment, or delivery. New source
 * sends explicit `variantSelection` (`base` or `reference` by id), never
 * legacy `variant`, and never omits selection as catalog unspecified.
 */
import type { WireErrorCode } from "@showzy/contract";
import {
  classifyProductSellability,
  type OrderLineCatalogFacts,
  type OrderLineCatalogFactsMap,
} from "@showzy/validation/order-line-catalog-facts";
import { emptyFieldErrors, type ItemsErrorKey } from "@showzy/validation/orders";

import type { QueryFailureKind } from "../../../api/errors";
import type { CreateOrderPayload } from "../api/create";
import {
  isOrderFormValid,
  parseOrderFormUiDraft,
  validateOrderForm,
  type OrderFormDraft,
  type OrderFormFieldErrors,
  type OrderFormLineDraft,
} from "./order-form-draft";

export type { CreateOrderPayload };
export type { OrderLineCatalogFactsMap };

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

function variantSelectionForLine(
  item: OrderFormLineDraft,
): NonNullable<CreateOrderPayload["items"][number]["variantSelection"]> {
  if (item.variantId === null) {
    return { kind: "base" };
  }
  return { kind: "reference", ref: { by: "id", id: item.variantId } };
}

function wireItems(draft: OrderFormDraft): CreateOrderPayload["items"] {
  return draft.items.map((item) => ({
    product: { by: "id" as const, id: item.productId },
    variantSelection: variantSelectionForLine(item),
    quantity: { milli: item.quantityMilli },
  }));
}

function catalogFactsReadyForDraft(
  draft: OrderFormDraft,
  catalogFacts: OrderLineCatalogFactsMap,
): boolean {
  return draft.items.every((item) => catalogFacts.has(item.productId));
}

function catalogErrorForLine(
  item: OrderFormLineDraft,
  facts: OrderLineCatalogFacts | undefined,
): ItemsErrorKey | null {
  if (facts === undefined) {
    return null;
  }
  const sellability = classifyProductSellability(facts.variantRows);
  if (item.variantId === null) {
    if (sellability === "simple") {
      return null;
    }
    if (sellability === "unavailable") {
      return "no_active_variants";
    }
    return "variant_required";
  }
  if (sellability === "unavailable") {
    return "no_active_variants";
  }
  const selected = facts.variantRows.find((row) => row.id === item.variantId);
  if (selected === undefined || selected.status !== "active") {
    return "variant_required";
  }
  return null;
}

export function validateOrderFormCatalog(
  draft: OrderFormDraft,
  catalogFacts: OrderLineCatalogFactsMap,
): OrderFormFieldErrors {
  let items: ItemsErrorKey | null = null;
  for (const item of draft.items) {
    const error = catalogErrorForLine(item, catalogFacts.get(item.productId));
    if (error !== null) {
      items = error;
      break;
    }
  }
  return { ...emptyFieldErrors(), items };
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
  readonly catalogFacts: OrderLineCatalogFactsMap;
  readonly lastWrite: OrderFormWrite | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly lastWireCode?: WireErrorCode | null;
}): OrderFormSavePlan {
  const errors = validateOrderForm(args.draft);
  if (!isOrderFormValid(errors)) {
    return { kind: "invalid", errors };
  }
  if (!catalogFactsReadyForDraft(args.draft, args.catalogFacts)) {
    return { kind: "invalid", errors: emptyFieldErrors() };
  }
  const catalogErrors = validateOrderFormCatalog(args.draft, args.catalogFacts);
  if (!isOrderFormValid(catalogErrors)) {
    return { kind: "invalid", errors: catalogErrors };
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

/** Same role as onboarding `nextLastSubmitted`: record the write before the round-trip. */
export function nextLastWrite(
  plan: OrderFormSavePlan,
  previous: OrderFormWrite | null,
): OrderFormWrite | null {
  return plan.kind === "write" ? plan.write : previous;
}

export function parseThenPlanOrderFormSave(args: {
  readonly draft: OrderFormDraft;
  readonly catalogFacts: OrderLineCatalogFactsMap;
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
