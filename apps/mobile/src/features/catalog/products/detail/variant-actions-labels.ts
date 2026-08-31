/**
 * Variant row price / a11y labels for the detail sheet (SHO-303).
 */
import type { ProductsCopy } from "../../../../i18n/products";
import {
  variantRowActionsLabel,
  variantRowPriceLabel,
  type ProductVariantView,
} from "./product-detail-model";

export function variantPriceLabel(
  copy: ProductsCopy,
  variant: ProductVariantView,
): string {
  return variantRowPriceLabel({
    inherited: variant.priceInherited,
    priceLabel: variant.priceLabel,
    inheritedTemplate: copy.form.variantInheritedPrice,
  });
}

export function variantAccessibilityLabel(
  copy: ProductsCopy,
  variant: ProductVariantView,
): string {
  return variantRowActionsLabel({
    variantName: variant.name,
    template: copy.detail.variantActionsLabel,
  });
}
