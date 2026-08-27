/**
 * Immediate createVariant / updateVariant from product detail (SHO-152).
 * Reuses the form write planner so detail does not fork a second payload.
 */
import { moneyToWire } from "@showzy/contract";

import {
  formatMajorUnitsFromMinor,
  parseMajorUnitsToMinor,
} from "../../../../format/money-input";
import type { ProductsFormCopy } from "../../../../i18n/products";
import type { ProductVariantView } from "./product-detail-model";
import { PRODUCT_FORM_MAX_VARIANTS } from "../shared/product-caps";
import type { BannerKey } from "../form/product-form-copy";
import {
  isVariantSheetValid,
  validateVariantSheet,
  type ProductFormSnapshot,
  type ProductFormVariantDraft,
  type VariantFieldErrors,
} from "../form/product-form-draft";
import {
  remainingFormWrites,
  type ProductFormWrite,
} from "../form/product-form-plan";

export type DetailVariantWritePlan =
  | { readonly kind: "invalid"; readonly errors: VariantFieldErrors }
  | { readonly kind: "too_many" }
  | { readonly kind: "noop" }
  | { readonly kind: "write"; readonly write: ProductFormWrite };

export function detailVariantToDraft(
  variant: ProductVariantView | null,
): ProductFormVariantDraft | null {
  if (variant === null) {
    return null;
  }
  return {
    key: variant.id,
    variantId: variant.id,
    name: variant.name,
    priceText:
      variant.priceMinor === null
        ? ""
        : formatMajorUnitsFromMinor(variant.priceMinor),
    archived: variant.archived,
  };
}

export function planDetailVariantWrite(args: {
  readonly productId: string;
  readonly variantCount: number;
  readonly existing: {
    readonly variantId: string;
    readonly name: string;
    readonly priceMinor: string | null;
  } | null;
  readonly name: string;
  readonly priceText: string;
}): DetailVariantWritePlan {
  const errors = validateVariantSheet({
    name: args.name,
    customPrice: args.priceText.trim().length > 0,
    priceText: args.priceText,
  });
  if (!isVariantSheetValid(errors)) {
    return { kind: "invalid", errors };
  }
  if (
    args.existing === null &&
    args.variantCount >= PRODUCT_FORM_MAX_VARIANTS
  ) {
    return { kind: "too_many" };
  }
  const priceMinor = priceMinorFromText(args.priceText);
  const snapshot: ProductFormSnapshot = {
    name: "",
    priceMinor: "0",
    variants: [
      {
        key: args.existing?.variantId ?? "new",
        variantId: args.existing?.variantId ?? null,
        name: args.name.trim(),
        priceMinor,
      },
    ],
  };
  const baseline: ProductFormSnapshot = {
    name: "",
    priceMinor: "0",
    variants:
      args.existing === null
        ? []
        : [
            {
              key: args.existing.variantId,
              variantId: args.existing.variantId,
              name: args.existing.name,
              priceMinor: args.existing.priceMinor,
            },
          ],
  };
  const write = remainingFormWrites(args.productId, snapshot, baseline)[0];
  if (write === undefined) {
    return { kind: "noop" };
  }
  return { kind: "write", write };
}

export function detailVariantBanner(
  key: BannerKey | null,
  copy: ProductsFormCopy,
): string | null {
  if (key === null) {
    return null;
  }
  if (key === "too_many_variants") {
    return copy.errors.tooManyVariants;
  }
  return copy.errors[key];
}

function priceMinorFromText(priceText: string): string | null {
  if (priceText.trim().length === 0) {
    return null;
  }
  const parsed = parseMajorUnitsToMinor(priceText);
  if (!parsed.ok) {
    return null;
  }
  return moneyToWire(parsed.minor);
}
