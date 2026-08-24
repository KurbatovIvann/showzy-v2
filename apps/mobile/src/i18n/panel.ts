/** Panel shell copy namespace (uk/en). Locale plumbing lives in `./locale`. */
import type { PanelTab } from "../components/screens/panel/panel-tabs";
import type { Locale } from "./locale";

export type MoreCopy = {
  readonly session: string;
  readonly userId: string;
  readonly phone: string;
  readonly email: string;
  readonly companySelector: string;
  readonly signOut: string;
};

export type PanelCopy = {
  readonly navigation: string;
  readonly tabs: Readonly<Record<PanelTab, string>>;
  readonly placeholderTitle: string;
  readonly placeholderDescription: string;
  readonly more: MoreCopy;
};

const en: PanelCopy = {
  navigation: "Main navigation",
  tabs: {
    orders: "Orders",
    products: "Products",
    ai: "AI",
    customers: "Customers",
    more: "More",
  },
  placeholderTitle: "Module in development",
  placeholderDescription: "This section is coming soon.",
  more: {
    session: "Session",
    userId: "User ID",
    phone: "Phone",
    email: "Email",
    companySelector: "Active company",
    signOut: "Sign Out",
  },
};

const uk: PanelCopy = {
  navigation: "Основна навігація",
  tabs: {
    orders: "Замовлення",
    products: "Товари",
    ai: "AI",
    customers: "Клієнти",
    more: "Ще",
  },
  placeholderTitle: "Модуль у розробці",
  placeholderDescription: "Цей розділ незабаром з’явиться.",
  more: {
    session: "Сесія",
    userId: "ID користувача",
    phone: "Телефон",
    email: "Email",
    companySelector: "Активна компанія",
    signOut: "Вийти",
  },
};

export function panelCopy(locale: Locale): PanelCopy {
  return locale === "uk" ? uk : en;
}
