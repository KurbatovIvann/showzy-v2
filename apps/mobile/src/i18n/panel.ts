/** Panel shell copy namespace (uk/en). Locale plumbing lives in `./locale`. */
import type { PanelTab } from "../components/screens/panel/panel-tabs";
import type { Locale } from "./locale";

export type PanelCopy = {
  readonly navigation: string;
  readonly tabs: Readonly<Record<PanelTab, string>>;
  readonly placeholderTitle: string;
  readonly placeholderDescription: string;
};

const en: PanelCopy = {
  navigation: "Main navigation",
  tabs: {
    orders: "Orders",
    products: "Products",
    ai: "AI",
    customers: "Customers",
  },
  placeholderTitle: "Module in development",
  placeholderDescription: "This section is coming soon.",
};

const uk: PanelCopy = {
  navigation: "Основна навігація",
  tabs: {
    orders: "Замовлення",
    products: "Товари",
    ai: "AI",
    customers: "Клієнти",
  },
  placeholderTitle: "Модуль у розробці",
  placeholderDescription: "Цей розділ незабаром з’явиться.",
};

export function panelCopy(locale: Locale): PanelCopy {
  return locale === "uk" ? uk : en;
}
