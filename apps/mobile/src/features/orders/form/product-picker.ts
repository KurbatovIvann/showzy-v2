/**
 * Product picker session (SHO-242 / SHO-249). Confirm-on-Готово: toggles
 * stay in the in-sheet draft; X discards; back from variants keeps
 * picks; Готово appends lines. Sheet chrome is a pure reducer — not
 * XState, not RHF. Variants are a second level of the same session,
 * not a second Modal.
 */
import {
  addOrderLine,
  type AddOrderLineInput,
  type OrderFormDraft,
  type OrderFormLineDraft,
} from "./order-form-draft";
import { orderLineIdentityKey } from "./order-form.schema";

export type ProductPickerPick = AddOrderLineInput;

export type ProductPickerState =
  | { readonly kind: "closed" }
  | { readonly kind: "products"; readonly picks: readonly ProductPickerPick[] }
  | {
      readonly kind: "variants";
      readonly productId: string;
      readonly productName: string;
      readonly picks: readonly ProductPickerPick[];
    };

export type ProductPickerEvent =
  | { readonly type: "open" }
  | { readonly type: "close" }
  | {
      readonly type: "toggleSimple";
      readonly productId: string;
      readonly productName: string;
    }
  | {
      readonly type: "openVariants";
      readonly productId: string;
      readonly productName: string;
    }
  | { readonly type: "closeVariants" }
  | {
      readonly type: "pickVariant";
      readonly variantId: string;
      readonly variantName: string | null;
    };

export function emptyProductPicker(): ProductPickerState {
  return { kind: "closed" };
}

const EMPTY_PICKS: readonly ProductPickerPick[] = [];
const EMPTY_ID_SET: ReadonlySet<string> = new Set();

export function productPickerOpen(state: ProductPickerState): boolean {
  return state.kind !== "closed";
}

export function productPickerPicks(
  state: ProductPickerState,
): readonly ProductPickerPick[] {
  if (state.kind === "closed") {
    return EMPTY_PICKS;
  }
  return state.picks;
}

export function productPickerSelectedIds(
  picks: readonly ProductPickerPick[],
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const pick of picks) {
    ids.add(pick.productId);
  }
  return ids;
}

/** In-sheet variant ids for the product whose variant list is open. */
export function productPickerSelectedVariantIds(
  state: ProductPickerState,
): ReadonlySet<string> {
  if (state.kind !== "variants") {
    return EMPTY_ID_SET;
  }
  return productPickerVariantIdsForProduct(state.picks, state.productId);
}

/** Variant picks for one product — used after back to mark the parent row. */
export function productPickerVariantPicksForProduct(
  picks: readonly ProductPickerPick[],
  productId: string,
): readonly ProductPickerPick[] {
  return picks.filter(
    (pick) => pick.productId === productId && pick.variantId !== null,
  );
}

export function productPickerVariantIdsForProduct(
  picks: readonly ProductPickerPick[],
  productId: string,
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const pick of productPickerVariantPicksForProduct(picks, productId)) {
    if (pick.variantId !== null) {
      ids.add(pick.variantId);
    }
  }
  return ids;
}

export function productPickerSelectedVariantNames(
  picks: readonly ProductPickerPick[],
  productId: string,
): readonly string[] {
  const names: string[] = [];
  for (const pick of productPickerVariantPicksForProduct(picks, productId)) {
    if (pick.variantName != null && pick.variantName.length > 0) {
      names.push(pick.variantName);
    }
  }
  return names;
}

function identityOf(pick: ProductPickerPick): string {
  return orderLineIdentityKey(pick.productId, pick.variantId);
}

function hasIdentity(
  picks: readonly ProductPickerPick[],
  pick: ProductPickerPick,
): boolean {
  const identity = identityOf(pick);
  return picks.some((item) => identityOf(item) === identity);
}

function togglePick(
  picks: readonly ProductPickerPick[],
  pick: ProductPickerPick,
): readonly ProductPickerPick[] {
  if (hasIdentity(picks, pick)) {
    const identity = identityOf(pick);
    return picks.filter((item) => identityOf(item) !== identity);
  }
  return [...picks, pick];
}

export function reduceProductPicker(
  state: ProductPickerState,
  event: ProductPickerEvent,
): ProductPickerState {
  switch (event.type) {
    case "open":
      return { kind: "products", picks: [] };
    case "close":
      return { kind: "closed" };
    case "toggleSimple": {
      if (state.kind !== "products") {
        return state;
      }
      return {
        kind: "products",
        picks: togglePick(state.picks, {
          productId: event.productId,
          variantId: null,
          productName: event.productName,
          variantName: null,
        }),
      };
    }
    case "openVariants": {
      if (state.kind !== "products") {
        return state;
      }
      return {
        kind: "variants",
        productId: event.productId,
        productName: event.productName,
        picks: state.picks,
      };
    }
    case "closeVariants": {
      if (state.kind !== "variants") {
        return state;
      }
      return { kind: "products", picks: state.picks };
    }
    case "pickVariant": {
      if (state.kind !== "variants") {
        return state;
      }
      return {
        kind: "variants",
        productId: state.productId,
        productName: state.productName,
        picks: togglePick(state.picks, {
          productId: state.productId,
          variantId: event.variantId,
          productName: state.productName,
          variantName: event.variantName,
        }),
      };
    }
  }
}

export type CommitProductPickerResult = {
  readonly draft: OrderFormDraft;
  readonly lines: readonly OrderFormLineDraft[];
  readonly rejected: "duplicate" | "too_many" | null;
};

export function commitProductPickerPicks(
  draft: OrderFormDraft,
  picks: readonly ProductPickerPick[],
): CommitProductPickerResult {
  let next = draft;
  const lines: OrderFormLineDraft[] = [];
  let rejected: "duplicate" | "too_many" | null = null;
  for (const pick of picks) {
    const result = addOrderLine(next, pick);
    if (!result.ok) {
      if (rejected === null) {
        rejected = result.reason;
      }
      continue;
    }
    next = result.draft;
    lines.push(result.line);
  }
  return { draft: next, lines, rejected };
}
