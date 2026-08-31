/**
 * Form variant sheet state, upsert, and field-array bookkeeping
 * (SHO-303). Composer stays in `use-product-form.ts`.
 */
import { useRef, useState } from "react";

import { PRODUCT_FORM_MAX_VARIANTS } from "../shared/product-caps";
import type { BannerKey } from "./product-form-copy";
import {
  cloneProductFormDraft,
  upsertVariantDraft,
  type ProductFormDraft,
  type ProductFormVariantDraft,
} from "./product-form-draft";

export type ProductFormVariantSheetState =
  | { readonly kind: "closed" }
  | { readonly kind: "new" }
  | { readonly kind: "edit"; readonly key: string };

export function useProductFormVariants(args: {
  readonly getDraft: () => ProductFormDraft;
  readonly setNextDraftSerial: (serial: number) => void;
  readonly append: (value: ProductFormVariantDraft) => void;
  readonly update: (index: number, value: ProductFormVariantDraft) => void;
  readonly fields: readonly ProductFormVariantDraft[];
  readonly onFieldEdit: () => void;
  readonly setLocalBanner: (key: BannerKey | null) => void;
}): {
  readonly variantSheet: ProductFormVariantSheetState;
  readonly variants: ProductFormVariantDraft[];
  readonly variantSheetInitial: ProductFormVariantDraft | null;
  readonly openNewVariant: () => void;
  readonly openEditVariant: (key: string) => void;
  readonly closeVariantSheet: () => void;
  readonly saveVariantFromSheet: (input: {
    readonly name: string;
    readonly priceText: string;
  }) => void;
} {
  const [variantSheet, setVariantSheet] =
    useState<ProductFormVariantSheetState>({ kind: "closed" });
  const variantSheetRef = useRef(variantSheet);
  variantSheetRef.current = variantSheet;

  function openNewVariant(): void {
    if (args.getDraft().variants.length >= PRODUCT_FORM_MAX_VARIANTS) {
      args.setLocalBanner("too_many_variants");
      return;
    }
    setVariantSheet({ kind: "new" });
  }

  function openEditVariant(key: string): void {
    setVariantSheet({ kind: "edit", key });
  }

  function closeVariantSheet(): void {
    setVariantSheet({ kind: "closed" });
  }

  function saveVariantFromSheet(input: {
    readonly name: string;
    readonly priceText: string;
  }): void {
    const sheet = variantSheetRef.current;
    if (sheet.kind === "closed") {
      return;
    }
    const current = cloneProductFormDraft(args.getDraft());
    if (
      sheet.kind === "new" &&
      current.variants.length >= PRODUCT_FORM_MAX_VARIANTS
    ) {
      args.setLocalBanner("too_many_variants");
      setVariantSheet({ kind: "closed" });
      return;
    }
    const next = upsertVariantDraft(current, {
      key: sheet.kind === "edit" ? sheet.key : null,
      name: input.name,
      priceText: input.priceText,
    });
    if (sheet.kind === "new") {
      const created = next.variants[next.variants.length - 1];
      if (created !== undefined) {
        args.append(created);
      }
    } else {
      const index = current.variants.findIndex(
        (variant) => variant.key === sheet.key,
      );
      const updated = next.variants[index];
      if (index >= 0 && updated !== undefined) {
        args.update(index, updated);
      }
    }
    args.setNextDraftSerial(next.nextDraftSerial);
    setVariantSheet({ kind: "closed" });
    args.onFieldEdit();
  }

  const variants: ProductFormVariantDraft[] = args.fields.map((field) => ({
    key: field.key,
    variantId: field.variantId,
    name: field.name,
    priceText: field.priceText,
    archived: field.archived,
  }));
  const variantSheetInitial =
    variantSheet.kind === "edit"
      ? (variants.find((variant) => variant.key === variantSheet.key) ?? null)
      : null;

  return {
    variantSheet,
    variants,
    variantSheetInitial,
    openNewVariant,
    openEditVariant,
    closeVariantSheet,
    saveVariantFromSheet,
  };
}
