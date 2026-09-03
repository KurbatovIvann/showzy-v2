import { ordersCopy, type OrdersCopy } from "../../../i18n/orders";
import { detectLocale } from "../../../i18n/locale";

export function useOrdersCopy(): OrdersCopy {
  const locale = typeof navigator === "undefined" ? "uk" : navigator.language;
  return ordersCopy(detectLocale(locale));
}

export function useOrdersLocale() {
  const tag = typeof navigator === "undefined" ? "uk" : navigator.language;
  return detectLocale(tag);
}
