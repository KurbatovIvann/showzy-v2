import { interpolate, type Locale } from "../../../../i18n/locale";
import type { CustomersCountForms } from "../../../../i18n/customers";
import { countPluralForm } from "./plural";

export function counterpartyCountLabel(
  count: number,
  locale: Locale,
  forms: CustomersCountForms,
): string | null {
  if (count <= 0) {
    return null;
  }
  const form = countPluralForm(count, locale);
  return interpolate(forms[form], { count: String(count) });
}
