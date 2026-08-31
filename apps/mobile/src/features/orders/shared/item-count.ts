/**
 * Locale-aware line-item count (canvas `pluralItems`). Ukrainian uses
 * the standard one/few/many cardinal rules; English is one/other.
 */
import type { CountForms } from "../../../i18n/copy";
import { interpolate, type Locale } from "../../../i18n/locale";
import { countPluralForm } from "../../../i18n/plural";

export function itemCountLabel(
  count: number,
  locale: Locale,
  forms: CountForms,
): string {
  return interpolate(forms[countPluralForm(count, locale)], {
    count: String(count),
  });
}
