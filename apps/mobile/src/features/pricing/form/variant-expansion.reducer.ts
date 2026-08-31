/**
 * Price-list variant expand/collapse session (SHO-304). Pure reducer —
 * fetch I/O and RHF append live in `use-variant-expansion.ts`.
 */
import type {
  PriceListCatalogVariant,
  PriceListVariantMeta,
} from "./price-list-form-draft";

export type VariantExpansionState = {
  readonly expandedProductIds: ReadonlySet<string>;
  readonly expandingProductIds: ReadonlySet<string>;
  readonly variantMeta: ReadonlyMap<string, PriceListVariantMeta>;
};

export const IDLE_VARIANT_EXPANSION: VariantExpansionState = {
  expandedProductIds: new Set(),
  expandingProductIds: new Set(),
  variantMeta: new Map(),
};

export type VariantExpansionEvent =
  | { readonly type: "collapse"; readonly productId: string }
  | { readonly type: "beginExpand"; readonly productId: string }
  | { readonly type: "expandFailed"; readonly productId: string }
  | {
      readonly type: "expandSucceeded";
      readonly productId: string;
      readonly variants: readonly PriceListCatalogVariant[];
    };

function withoutId(ids: ReadonlySet<string>, productId: string): Set<string> {
  const next = new Set(ids);
  next.delete(productId);
  return next;
}

export function reduceVariantExpansion(
  state: VariantExpansionState,
  event: VariantExpansionEvent,
): VariantExpansionState {
  switch (event.type) {
    case "collapse": {
      if (!state.expandedProductIds.has(event.productId)) {
        return state;
      }
      return {
        ...state,
        expandedProductIds: withoutId(
          state.expandedProductIds,
          event.productId,
        ),
      };
    }
    case "beginExpand": {
      if (
        state.expandedProductIds.has(event.productId) ||
        state.expandingProductIds.has(event.productId)
      ) {
        return state;
      }
      const expanding = new Set(state.expandingProductIds);
      expanding.add(event.productId);
      return { ...state, expandingProductIds: expanding };
    }
    case "expandFailed": {
      if (!state.expandingProductIds.has(event.productId)) {
        return state;
      }
      return {
        ...state,
        expandingProductIds: withoutId(
          state.expandingProductIds,
          event.productId,
        ),
      };
    }
    case "expandSucceeded": {
      const variantMeta = new Map(state.variantMeta);
      for (const variant of event.variants) {
        variantMeta.set(variant.id, {
          name: variant.name,
          archived: variant.archived,
          basePriceMinor: variant.basePriceMinor,
        });
      }
      const expanded = new Set(state.expandedProductIds);
      expanded.add(event.productId);
      return {
        expandedProductIds: expanded,
        expandingProductIds: withoutId(
          state.expandingProductIds,
          event.productId,
        ),
        variantMeta,
      };
    }
  }
}
