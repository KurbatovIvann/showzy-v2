/**
 * Hydrate the editor from get + entries + catalog, and own the keyed
 * origin / baseline refs (SHO-304). RHF `reset` stays a port.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import {
  draftFromPriceList,
  emptyPriceListFormDraft,
  originFromDraft,
  snapshotFromPriceList,
  storedEntryMap,
  type PriceListFormDraft,
  type PriceListFormMode,
  type PriceListFormOrigin,
  type PriceListFormSnapshot,
} from "./price-list-form-draft";
import {
  catalogProductsForForm,
  storedEntriesForForm,
} from "./price-list-form-rows";

type ListHydrateRow = {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly isActive: boolean;
};

export function usePriceListFormHydrate(args: {
  readonly mode: PriceListFormMode;
  readonly reset: (draft: PriceListFormDraft) => void;
  readonly listData: ListHydrateRow | undefined;
  readonly catalogData:
    Parameters<typeof catalogProductsForForm>[0] | undefined;
  readonly entriesData: Parameters<typeof storedEntriesForForm>[0] | undefined;
}): {
  readonly originRef: { current: PriceListFormOrigin };
  readonly originDraftRef: { current: PriceListFormDraft };
  readonly originTick: number;
  readonly originName: string;
  readonly baselineRef: { current: PriceListFormSnapshot | null };
  readonly commitOrigin: (draft: PriceListFormDraft) => void;
  readonly commitBaseline: (baseline: PriceListFormSnapshot | null) => void;
} {
  const originDraftRef = useRef(emptyPriceListFormDraft());
  const originRef = useRef<PriceListFormOrigin>(
    originFromDraft(originDraftRef.current),
  );
  const [originTick, setOriginTick] = useState(0);
  const baselineRef = useRef<PriceListFormSnapshot | null>(null);
  const hydratedIdRef = useRef<string | null>(null);
  const resetRef = useRef(args.reset);
  resetRef.current = args.reset;

  const commitOrigin = useCallback((draft: PriceListFormDraft) => {
    originDraftRef.current = draft;
    originRef.current = originFromDraft(draft);
    setOriginTick((tick) => tick + 1);
  }, []);
  const commitBaseline = useCallback(
    (baseline: PriceListFormSnapshot | null) => {
      baselineRef.current = baseline;
    },
    [],
  );

  useEffect(() => {
    if (args.mode !== "edit") {
      return;
    }
    const list = args.listData;
    const catalog = args.catalogData;
    const entries = args.entriesData;
    if (list === undefined || catalog === undefined || entries === undefined) {
      return;
    }
    if (hydratedIdRef.current === list.id) {
      return;
    }
    hydratedIdRef.current = list.id;
    const products = catalogProductsForForm(catalog);
    const stored = storedEntryMap(storedEntriesForForm(entries));
    const next = draftFromPriceList({
      name: list.name,
      isDefault: list.isDefault,
      isActive: list.isActive,
      products,
      stored,
    });
    resetRef.current(next);
    baselineRef.current = snapshotFromPriceList({
      name: list.name,
      isDefault: list.isDefault,
      isActive: list.isActive,
      products,
      stored,
    });
    commitOrigin(next);
  }, [
    args.catalogData,
    args.entriesData,
    args.listData,
    args.mode,
    commitOrigin,
  ]);

  return {
    originRef,
    originDraftRef,
    originTick,
    originName: originRef.current.name,
    baselineRef,
    commitOrigin,
    commitBaseline,
  };
}
