import { interpolate, type Locale } from "../../../i18n/locale";
import type { PricingCountForms } from "../../../i18n/pricing";
import { countPluralForm } from "./plural";

export function entryCountLabel(
  count: number,
  locale: Locale,
  forms: PricingCountForms,
): string {
  if (count === 0) {
    return forms.none;
  }
  const form = countPluralForm(count, locale);
  return interpolate(forms[form], { count: String(count) });
}
