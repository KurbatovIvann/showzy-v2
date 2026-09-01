/**
 * Customer sheet + product-picker chrome (SHO-305). Confirm/toggle
 * stay in the composer so they can read RHF and lookups.
 */
import { useCallback, useMemo, useReducer, useRef, useState } from "react";

import {
  presentProductPickerLevel,
  presentProductPickerVariantsTitle,
} from "./order-form.presenter";
import {
  emptyProductPicker,
  productPickerOpen,
  productPickerPicks,
  productPickerSelectedIds,
  productPickerSelectedVariantIds,
  reduceProductPicker,
  type ProductPickerEvent,
  type ProductPickerState,
} from "./product-picker";

export function useOrderFormSheets(): {
  readonly customerSheetOpen: boolean;
  readonly picker: ProductPickerState;
  readonly pickerRef: { current: ProductPickerState };
  readonly dispatchPicker: (event: ProductPickerEvent) => void;
  readonly productSheetOpen: boolean;
  readonly productPickerSessionOpen: boolean;
  readonly productPickerLevel: ReturnType<typeof presentProductPickerLevel>;
  readonly productPickerVariantsTitle: string;
  readonly selectedProductIds: ReadonlySet<string>;
  readonly selectedVariantIds: ReadonlySet<string>;
  readonly productPickCount: number;
  readonly closeAllSheets: () => void;
  readonly openCustomerSheet: () => void;
  readonly openProductsSheet: () => void;
  readonly closeCustomerSheet: () => void;
  readonly closeProductSheet: () => void;
  readonly backFromVariants: () => void;
} {
  const [customerSheetOpen, setCustomerSheetOpen] = useState(false);
  const [picker, dispatchPicker] = useReducer(
    reduceProductPicker,
    emptyProductPicker(),
  );
  const pickerRef = useRef(picker);
  pickerRef.current = picker;

  const picks = productPickerPicks(picker);
  const selectedProductIds = useMemo(
    () => productPickerSelectedIds(picks),
    [picks],
  );
  const selectedVariantIds = productPickerSelectedVariantIds(picker);

  const closeAllSheets = useCallback(() => {
    setCustomerSheetOpen(false);
    dispatchPicker({ type: "close" });
  }, []);
  const openCustomerSheet = useCallback(() => {
    dispatchPicker({ type: "close" });
    setCustomerSheetOpen(true);
  }, []);
  const openProductsSheet = useCallback(() => {
    setCustomerSheetOpen(false);
    dispatchPicker({ type: "open" });
  }, []);
  const closeCustomerSheet = useCallback(() => {
    setCustomerSheetOpen(false);
  }, []);
  const closeProductSheet = useCallback(() => {
    dispatchPicker({ type: "close" });
  }, []);
  const backFromVariants = useCallback(() => {
    dispatchPicker({ type: "closeVariants" });
  }, []);

  return {
    customerSheetOpen,
    picker,
    pickerRef,
    dispatchPicker,
    productSheetOpen: productPickerOpen(picker),
    productPickerSessionOpen: productPickerOpen(picker),
    productPickerLevel: presentProductPickerLevel(picker),
    productPickerVariantsTitle: presentProductPickerVariantsTitle(picker),
    selectedProductIds,
    selectedVariantIds,
    productPickCount: picks.length,
    closeAllSheets,
    openCustomerSheet,
    openProductsSheet,
    closeCustomerSheet,
    closeProductSheet,
    backFromVariants,
  };
}
