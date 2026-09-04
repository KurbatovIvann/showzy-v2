/**
 * Product form draft, snapshot, and dirty detection (SHO-163).
 * UI Zod lives in `product-form.schema.ts`; write planning is
 * `product-form-plan.ts`.
 */
import { moneyToWire } from "@showzy/contract";

import { formatMoneyMinor } from "../../../../format/money";
import {
  formatMajorUnitsFromMinor,
  parseMajorUnitsToMinor,
} from "../../../../format/money-input";
import {
  PRODUCT_CURRENCY,
  PRODUCT_FORM_MAX_VARIANTS,
} from "../shared/product-caps";
import type { GetProductOutput } from "../api/product-detail-query";
import {
  emptyFieldErrors,
  fieldErrorsFromDraftSchema,
  productFormDraftSchema,
  variantSheetErrorsFromSchema,
  variantSheetSchema,
  type ProductFormFieldErrors,
  type VariantFieldErrors,
} from "./product-form.schema";

export {
  emptyFieldErrors,
  type NameErrorKey,
  type PriceErrorKey,
  type ProductFormFieldErrors,
  type VariantFieldErrors,
} from "./product-form.schema";

export type ProductFormMode = "create" | "edit";

export type ProductFormVariantDraft = {
  key: string;
  variantId: string | null;
  name: string;
  priceText: string;
  archived: boolean;
};

export type ProductFormDraft = {
  name: string;
  priceText: string;
  variants: ProductFormVariantDraft[];
  nextDraftSerial: number;
};

export type VariantSnapshot = {
  readonly key: string;
  readonly variantId: string | null;
  readonly name: string;
  readonly priceMinor: string | null;
};

export type ProductFormSnapshot = {
  readonly name: string;
  readonly priceMinor: string;
  readonly variants: readonly VariantSnapshot[];
};

export function emptyProductFormDraft(): ProductFormDraft {
  return { name: "", priceText: "", variants: [], nextDraftSerial: 1 };
}

export function cloneProductFormDraft(
  values: ProductFormDraft,
): ProductFormDraft {
  return {
    name: values.name,
    priceText: values.priceText,
    nextDraftSerial: values.nextDraftSerial,
    variants: values.variants.map((variant) => ({
      key: variant.key,
      variantId: variant.variantId,
      name: variant.name,
      priceText: variant.priceText,
      archived: variant.archived,
    })),
  };
}

export function draftFromProduct(product: GetProductOutput): ProductFormDraft {
  return {
    name: product.name,
    priceText: formatMajorUnitsFromMinor(product.basePriceMinor),
    variants: product.variants.map((variant) => ({
      key: variant.id,
      variantId: variant.id,
      name: variant.name,
      priceText:
        variant.basePriceMinor === null
          ? ""
          : formatMajorUnitsFromMinor(variant.basePriceMinor),
      archived: variant.status === "archived",
    })),
    nextDraftSerial: 1,
  };
}

/** Server snapshot for dirty detection — trims names like `snapshotFromDraft`. */
export function snapshotFromProduct(
  product: GetProductOutput,
): ProductFormSnapshot {
  return {
    name: product.name.trim(),
    priceMinor: product.basePriceMinor,
    variants: product.variants.map((variant) => ({
      key: variant.id,
      variantId: variant.id,
      name: variant.name.trim(),
      priceMinor: variant.basePriceMinor,
    })),
  };
}

export function addVariantRow(draft: ProductFormDraft): ProductFormDraft {
  if (draft.variants.length >= PRODUCT_FORM_MAX_VARIANTS) {
    return draft;
  }
  const key = `draft-${String(draft.nextDraftSerial)}`;
  return {
    ...draft,
    nextDraftSerial: draft.nextDraftSerial + 1,
    variants: [
      ...draft.variants,
      {
        key,
        variantId: null,
        name: "",
        priceText: "",
        archived: false,
      },
    ],
  };
}

export function removeVariantRow(
  draft: ProductFormDraft,
  key: string,
): ProductFormDraft {
  const target = draft.variants.find((variant) => variant.key === key);
  if (target === undefined || target.variantId !== null) {
    return draft;
  }
  return {
    ...draft,
    variants: draft.variants.filter((variant) => variant.key !== key),
  };
}

export function patchDraft(
  draft: ProductFormDraft,
  patch: {
    readonly name?: string;
    readonly priceText?: string;
    readonly variantKey?: string;
    readonly variantName?: string;
    readonly variantPriceText?: string;
  },
): ProductFormDraft {
  if (patch.variantKey !== undefined) {
    return {
      ...draft,
      variants: draft.variants.map((variant) => {
        if (variant.key !== patch.variantKey) {
          return variant;
        }
        return {
          ...variant,
          name: patch.variantName ?? variant.name,
          priceText: patch.variantPriceText ?? variant.priceText,
        };
      }),
    };
  }
  return {
    ...draft,
    name: patch.name ?? draft.name,
    priceText: patch.priceText ?? draft.priceText,
  };
}

function isBlankUnsavedVariant(variant: ProductFormVariantDraft): boolean {
  return (
    variant.variantId === null &&
    variant.name.trim().length === 0 &&
    variant.priceText.trim().length === 0
  );
}

export function compactDraft(draft: ProductFormDraft): ProductFormDraft {
  return {
    ...draft,
    variants: draft.variants.filter(
      (variant) => !isBlankUnsavedVariant(variant),
    ),
  };
}

export type VariantSheetDraft = {
  readonly name: string;
  readonly customPrice: boolean;
  readonly priceText: string;
};

export function variantDraftToSheet(
  variant: ProductFormVariantDraft | null,
): VariantSheetDraft {
  if (variant === null) {
    return { name: "", customPrice: false, priceText: "" };
  }
  return {
    name: variant.name,
    customPrice: variant.priceText.trim().length > 0,
    priceText: variant.priceText,
  };
}

export function variantSheetPriceText(draft: VariantSheetDraft): string {
  return draft.customPrice ? draft.priceText : "";
}

/** True only on closed→open so a parent re-render does not wipe in-progress edits. */
export function shouldHydrateVariantSheet(
  visible: boolean,
  wasVisible: boolean,
): boolean {
  return visible && !wasVisible;
}

export function validateVariantSheet(
  draft: VariantSheetDraft,
): VariantFieldErrors {
  const parsed = variantSheetSchema.safeParse(draft);
  if (parsed.success) {
    return { name: null, price: null };
  }
  return variantSheetErrorsFromSchema(parsed.error);
}

export function isVariantSheetValid(errors: VariantFieldErrors): boolean {
  return errors.name === null && errors.price === null;
}

export function upsertVariantDraft(
  draft: ProductFormDraft,
  args: {
    readonly key: string | null;
    readonly name: string;
    readonly priceText: string;
  },
): ProductFormDraft {
  if (args.key === null) {
    if (draft.variants.length >= PRODUCT_FORM_MAX_VARIANTS) {
      return draft;
    }
    const added = addVariantRow(draft);
    const created = added.variants[added.variants.length - 1];
    if (created === undefined) {
      return draft;
    }
    return patchDraft(added, {
      variantKey: created.key,
      variantName: args.name,
      variantPriceText: args.priceText,
    });
  }
  return patchDraft(draft, {
    variantKey: args.key,
    variantName: args.name,
    variantPriceText: args.priceText,
  });
}

export function isProductFormDirty(
  draft: ProductFormDraft,
  origin: ProductFormDraft,
): boolean {
  if (draft.name !== origin.name || draft.priceText !== origin.priceText) {
    return true;
  }
  const left = compactDraft(draft).variants;
  const right = compactDraft(origin).variants;
  if (left.length !== right.length) {
    return true;
  }
  for (let index = 0; index < left.length; index += 1) {
    const current = left[index];
    const previous = right[index];
    if (current === undefined || previous === undefined) {
      return true;
    }
    if (
      current.key !== previous.key ||
      current.variantId !== previous.variantId ||
      current.name !== previous.name ||
      current.priceText !== previous.priceText
    ) {
      return true;
    }
  }
  return false;
}

export function productFormFieldChanged(
  mode: ProductFormMode,
  current: string,
  origin: string,
): boolean {
  return mode === "edit" && current !== origin;
}

export function formatProductFormFooterPrice(priceText: string): string {
  const parsed = parseMajorUnitsToMinor(priceText);
  if (!parsed.ok) {
    return formatMoneyMinor("0", PRODUCT_CURRENCY);
  }
  return formatMoneyMinor(moneyToWire(parsed.minor), PRODUCT_CURRENCY);
}

export function productFormFooterPriceMuted(priceText: string): boolean {
  const parsed = parseMajorUnitsToMinor(priceText);
  return !parsed.ok || parsed.minor === 0n;
}

function draftSchemaInput(draft: ProductFormDraft) {
  return {
    name: draft.name,
    priceText: draft.priceText,
    nextDraftSerial: draft.nextDraftSerial,
    variants: draft.variants.map((variant) => ({
      key: variant.key,
      variantId: variant.variantId,
      name: variant.name,
      priceText: variant.priceText,
      archived: variant.archived,
    })),
  };
}

export function validateProductForm(
  draft: ProductFormDraft,
): ProductFormFieldErrors {
  const compacted = compactDraft(draft);
  const parsed = productFormDraftSchema.safeParse(draftSchemaInput(compacted));
  if (parsed.success) {
    return emptyFieldErrors();
  }
  return fieldErrorsFromDraftSchema(parsed.error, compacted.variants);
}

export function isProductFormValid(errors: ProductFormFieldErrors): boolean {
  if (errors.name !== null || errors.price !== null) {
    return false;
  }
  return Object.values(errors.variants).every(
    (variant) => variant.name === null && variant.price === null,
  );
}

/**
 * Successful UI parse of the draft schema (same Zod as
 * `productFormResolver`). Call this before `planProductFormSave`.
 */
export type ProductFormUiParse =
  | { readonly ok: true; readonly draft: ProductFormDraft }
  | { readonly ok: false; readonly errors: ProductFormFieldErrors };

export function parseProductFormUiDraft(
  draft: ProductFormDraft,
): ProductFormUiParse {
  const compacted = compactDraft(draft);
  const errors = validateProductForm(compacted);
  if (!isProductFormValid(errors)) {
    return { ok: false, errors };
  }
  return { ok: true, draft: compacted };
}

export function snapshotFromDraft(
  draft: ProductFormDraft,
): ProductFormSnapshot | null {
  const compacted = compactDraft(draft);
  const errors = validateProductForm(compacted);
  if (!isProductFormValid(errors)) {
    return null;
  }
  const price = parseMajorUnitsToMinor(compacted.priceText);
  if (!price.ok) {
    return null;
  }
  return {
    name: compacted.name.trim(),
    priceMinor: moneyToWire(price.minor),
    variants: compacted.variants.map((variant) => {
      const parsed = parseMajorUnitsToMinor(variant.priceText);
      return {
        key: variant.key,
        variantId: variant.variantId,
        name: variant.name.trim(),
        priceMinor: parsed.ok ? moneyToWire(parsed.minor) : null,
      };
    }),
  };
}
