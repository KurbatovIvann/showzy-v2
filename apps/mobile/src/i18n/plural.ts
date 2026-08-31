/**
 * Ukrainian one/few/many cardinal rules and English one/other (mapped
 * onto `many`). Shared by orders, pricing, customers, and catalog
 * count labels — do not copy the mod-10/mod-100 logic into a feature.
 */
import type { CountForms } from "./copy";
import type { Locale } from "./locale";

export type CountPluralForm = keyof CountForms;

export function countPluralForm(
  count: number,
  locale: Locale,
): CountPluralForm {
  if (locale !== "uk") {
    return count === 1 ? "one" : "many";
  }
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
