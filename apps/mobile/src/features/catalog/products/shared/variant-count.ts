/**
 * Locale-aware variant count label (canvas `variantCountLabel`).
 * Ukrainian uses the standard one/few/many cardinal rules; English is
 * one/other.
 */
import { interpolate, type Locale } from "../../../../i18n/locale";
import { countPluralForm } from "../../../../i18n/plural";
import type { ProductsVariantForms } from "../../../../i18n/products";

export function variantCountLabel(
  count: number,
  locale: Locale,
  forms: ProductsVariantForms,
): string {
  if (count === 0) {
    return forms.none;
  }
  return interpolate(forms[countPluralForm(count, locale)], {
    count: String(count),
  });
}
