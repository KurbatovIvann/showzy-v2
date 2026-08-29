/**
 * Locale-aware line-item count (canvas `pluralItems`). Ukrainian uses
 * the standard one/few/many cardinal rules; English is one/other.
 */
import { interpolate, type Locale } from "../../../i18n/locale";
import type { OrdersCountForms } from "../../../i18n/orders";

type PluralForm = keyof OrdersCountForms;

function ukrainianPluralForm(count: number): PluralForm {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return "one";
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "few";
  }
  return "many";
}

function englishPluralForm(count: number): PluralForm {
  return count === 1 ? "one" : "many";
}

export function itemCountLabel(
  count: number,
  locale: Locale,
  forms: OrdersCountForms,
): string {
  const form =
    locale === "uk" ? ukrainianPluralForm(count) : englishPluralForm(count);
  return interpolate(forms[form], { count: String(count) });
}
