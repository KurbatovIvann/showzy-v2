/** Staff assistant (Shozik) copy namespace (uk/en). */
import { selectCopy, writeErrorsEn, writeErrorsUk } from "./copy";
import type { Locale } from "./locale";

export type AssistantJobsCopy = {
  readonly orders_list_page: string;
  readonly orders_list_counts: string;
  readonly orders_get: string;
  readonly orders_create: string;
  readonly catalog_list_products: string;
  readonly pricing_list_price_lists: string;
  readonly customers_listCustomers: string;
  readonly fallback: string;
};

export type AssistantCardsCopy = {
  readonly listEmptyTitle: string;
  readonly listEmptyDescription: string;
  readonly openOrders: string;
  readonly customerMatchTruncated: string;
  readonly clipped: string;
};

export type AssistantCopy = {
  readonly sheetTitle: string;
  readonly emptyTitle: string;
  readonly emptyDescription: string;
  readonly inputPlaceholder: string;
  readonly inputLabel: string;
  readonly sendLabel: string;
  readonly confirmLabel: string;
  readonly dismissLabel: string;
  readonly confirmingLabel: string;
  readonly confirmationTitle: string;
  readonly thinkingLabel: string;
  readonly timelineLabel: string;
  readonly jobs: AssistantJobsCopy;
  readonly cards: AssistantCardsCopy;
  readonly errors: {
    readonly validation: string;
    readonly network: string;
    readonly offline: string;
    readonly unavailable: string;
    readonly permission: string;
    readonly unauthenticated: string;
    readonly notConfigured: string;
  };
};

const en: AssistantCopy = {
  sheetTitle: "Shozik",
  emptyTitle: "How can I help?",
  emptyDescription:
    "I can look up orders, customers, and documents. Writes run only after you confirm.",
  inputPlaceholder: "Write a request…",
  inputLabel: "Message to the assistant",
  sendLabel: "Send",
  confirmLabel: "Confirm",
  dismissLabel: "Cancel",
  confirmingLabel: "Confirming…",
  confirmationTitle: "Confirmation required",
  thinkingLabel: "Shozik is thinking",
  timelineLabel: "Progress",
  jobs: {
    orders_list_page: "Looking up orders",
    orders_list_counts: "Counting turnover",
    orders_get: "Opening the order",
    orders_create: "Creating the order",
    catalog_list_products: "Searching the catalog",
    pricing_list_price_lists: "Looking up price lists",
    customers_listCustomers: "Looking up customers",
    fallback: "Working",
  },
  cards: {
    listEmptyTitle: "No orders",
    listEmptyDescription: "No orders match this request.",
    openOrders: "Open orders",
    customerMatchTruncated:
      "Customer name matches were truncated. Refine the search or open the list.",
    clipped: "The list was clipped. Open orders to see everything.",
  },
  errors: {
    ...writeErrorsEn,
    network: "Could not reach the assistant. Try again.",
    unavailable: "The assistant is unavailable. Try again.",
    permission: "You do not have permission to use the assistant.",
    unauthenticated: "Sign in again to continue.",
    notConfigured: "The assistant is not configured.",
  },
};

const uk: AssistantCopy = {
  sheetTitle: "Шозік",
  emptyTitle: "Чим допомогти?",
  emptyDescription:
    "Знайду замовлення, клієнтів і документи. Запис у систему — лише після підтвердження.",
  inputPlaceholder: "Напишіть запит…",
  inputLabel: "Повідомлення асистенту",
  sendLabel: "Надіслати",
  confirmLabel: "Підтвердити",
  dismissLabel: "Скасувати",
  confirmingLabel: "Підтверджую…",
  confirmationTitle: "Потрібне підтвердження",
  thinkingLabel: "Шозік думає",
  timelineLabel: "Хід роботи",
  jobs: {
    orders_list_page: "Шукаю замовлення",
    orders_list_counts: "Рахую виторг",
    orders_get: "Відкриваю замовлення",
    orders_create: "Створюю замовлення",
    catalog_list_products: "Шукаю в каталозі",
    pricing_list_price_lists: "Шукаю прайси",
    customers_listCustomers: "Шукаю клієнтів",
    fallback: "Працюю",
  },
  cards: {
    listEmptyTitle: "Немає замовлень",
    listEmptyDescription: "За цим запитом замовлень немає.",
    openOrders: "Відкрити замовлення",
    customerMatchTruncated:
      "Збіги за імʼям клієнта обрізано. Уточніть запит або відкрийте список.",
    clipped: "Список обрізано. Відкрийте замовлення, щоб побачити все.",
  },
  errors: {
    ...writeErrorsUk,
    network: "Не вдалося звʼязатися з асистентом. Спробуйте ще раз.",
    unavailable: "Асистент недоступний. Спробуйте ще раз.",
    permission: "Немає права користуватися асистентом.",
    unauthenticated: "Увійдіть знову, щоб продовжити.",
    notConfigured: "Асистент не налаштований.",
  },
};

export function assistantCopy(locale: Locale): AssistantCopy {
  return selectCopy(locale, { uk, en });
}
