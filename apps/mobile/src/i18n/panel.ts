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
  readonly management: string;
  readonly priceLists: string;
  readonly priceListsDescription: string;
  readonly documents: string;
  readonly documentsDescription: string;
  readonly documentsDisabledHint: string;
  readonly settings: string;
  readonly companySettings: string;
  readonly companySettingsDescription: string;
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
    management: "Management",
    priceLists: "Price lists",
    priceListsDescription: "Different prices for customer groups",
    documents: "Documents",
    documentsDescription: "Invoices and delivery notes",
    documentsDisabledHint: "Coming soon",
    settings: "Settings",
    companySettings: "Company settings",
    companySettingsDescription: "Profile and legal requisites",
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
    management: "Керування",
    priceLists: "Прайс-листи",
    priceListsDescription: "Різні ціни для груп клієнтів",
    documents: "Документи",
    documentsDescription: "Рахунки та видаткові накладні",
    documentsDisabledHint: "Незабаром",
    settings: "Налаштування",
    companySettings: "Налаштування компанії",
    companySettingsDescription: "Профіль і юридичні реквізити",
  },
};

export function panelCopy(locale: Locale): PanelCopy {
  return locale === "uk" ? uk : en;
}
