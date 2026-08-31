/**
 * Variant expand session + catalog.getProduct fetch (SHO-304). Reducer
 * owns expanded/expanding/meta; merge stays pure in the draft module.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useReducer, useRef } from "react";
import type { UseFieldArrayAppend } from "react-hook-form";

import type { ContractClient } from "../../../api/client";
import { getCatalogProductQueryOptions } from "../api/catalog-products-query";
import {
  mergeExpandedVariants,
  type PriceListFormDraft,
  type PriceListFormSnapshot,
} from "./price-list-form-draft";
import { variantsFromGetProduct } from "./price-list-form-rows";
import {
  IDLE_VARIANT_EXPANSION,
  reduceVariantExpansion,
  type VariantExpansionEvent,
  type VariantExpansionState,
} from "./variant-expansion.reducer";

export function useVariantExpansion(args: {
  readonly apiClient: ContractClient | null;
  readonly activeCompanyId: string | null;
  readonly getValues: () => PriceListFormDraft;
  readonly originDraftRef: { current: PriceListFormDraft };
  readonly baselineRef: { current: PriceListFormSnapshot | null };
  readonly storedRef: { current: ReadonlyMap<string, string> };
  readonly append: UseFieldArrayAppend<PriceListFormDraft, "entries">;
  readonly commitOrigin: (draft: PriceListFormDraft) => void;
  readonly commitBaseline: (baseline: PriceListFormSnapshot | null) => void;
  readonly onUnavailable: () => void;
}): {
  readonly state: VariantExpansionState;
  readonly toggleExpand: (productId: string) => void;
} {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(
    reduceVariantExpansion,
    IDLE_VARIANT_EXPANSION,
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const argsRef = useRef(args);
  argsRef.current = args;
  const send = useCallback((event: VariantExpansionEvent) => {
    stateRef.current = reduceVariantExpansion(stateRef.current, event);
    dispatch(event);
  }, []);

  const toggleExpand = useCallback(
    (productId: string) => {
      const current = argsRef.current;
      const session = stateRef.current;
      if (session.expandedProductIds.has(productId)) {
        send({ type: "collapse", productId });
        return;
      }
      if (
        current.apiClient === null ||
        session.expandingProductIds.has(productId)
      ) {
        return;
      }
      const client = current.apiClient;
      send({ type: "beginExpand", productId });
      void queryClient
        .fetchQuery(
          getCatalogProductQueryOptions({
            client,
            companyId: current.activeCompanyId,
            productId,
            getActiveCompany: () => client.getActiveCompany() ?? null,
          }),
        )
        .then((product) => {
          const variants = variantsFromGetProduct(product.variants);
          const merged = mergeExpandedVariants({
            draft: current.getValues(),
            origin: current.originDraftRef.current,
            baseline: current.baselineRef.current,
            productId,
            variants,
            stored: current.storedRef.current,
          });
          const existing = new Set(
            current.getValues().entries.map((entry) => entry.key),
          );
          for (const entry of merged.draft.entries) {
            if (!existing.has(entry.key)) {
              current.append(entry, { shouldFocus: false });
            }
          }
          current.commitOrigin(merged.origin);
          current.commitBaseline(merged.baseline);
          send({ type: "expandSucceeded", productId, variants });
        })
        .catch(() => {
          current.onUnavailable();
          send({ type: "expandFailed", productId });
        });
    },
    [queryClient, send],
  );

  return { state, toggleExpand };
}

export type { VariantExpansionState };
