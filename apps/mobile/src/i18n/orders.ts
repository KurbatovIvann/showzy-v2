/** Orders list copy namespace (uk/en). Locale plumbing lives in `./locale`. */
import type { Locale } from "./locale";

export type OrdersCountForms = {
  readonly one: string;
  readonly few: string;
  readonly many: string;
};

export type OrdersCopy = {
  readonly title: string;
  readonly createLabel: string;
  readonly filterLabel: string;
  readonly filterActiveLabel: string;
  readonly filterTitle: string;
  readonly filterStatus: string;
  readonly filterReset: string;
  readonly filterApply: string;
  readonly closeSheet: string;
  readonly statuses: {
    readonly new: string;
    readonly confirmed: string;
    readonly canceled: string;
  };
  readonly groups: {
    readonly inProgress: string;
    readonly completed: string;
  };
  readonly groupCount: string;
  readonly items: OrdersCountForms;
  readonly missingCustomer: string;
  readonly loadingLabel: string;
  readonly loadingMoreLabel: string;
  readonly empty: {
    readonly offlineTitle: string;
    readonly offlineDescription: string;
    readonly errorTitle: string;
    readonly errorDescription: string;
    readonly retry: string;
    readonly filteredTitle: string;
    readonly filteredDescription: string;
    readonly reset: string;
    readonly catalogTitle: string;
    readonly catalogDescription: string;
    readonly create: string;
  };
};

const en: OrdersCopy = {
  title: "Orders",
  createLabel: "New order",
  filterLabel: "Filters",
  filterActiveLabel: "Filters, {{count}} selected",
  filterTitle: "Filters",
  filterStatus: "Order status",
  filterReset: "Reset",
  filterApply: "Show",
  closeSheet: "Close",
  statuses: {
    new: "New",
    confirmed: "Confirmed",
    canceled: "Canceled",
  },
  groups: {
    inProgress: "In progress",
    completed: "Completed",
  },
  groupCount: "{{title}} · {{count}}",
  items: {
    one: "{{count}} item",
    few: "{{count}} items",
    many: "{{count}} items",
  },
  missingCustomer: "Deleted customer",
  loadingLabel: "Loading orders",
  loadingMoreLabel: "Loading more orders",
  empty: {
    offlineTitle: "No connection",
    offlineDescription:
      "The order list is unavailable offline. Connect and try again.",
    errorTitle: "Could not load orders",
    errorDescription: "Check your connection and try again.",
    retry: "Retry",
    filteredTitle: "Nothing found",
    filteredDescription: "Change the filters or reset them.",
    reset: "Reset filters",
    catalogTitle: "No orders yet",
    catalogDescription:
      "Create the first order manually or ask the assistant to do it.",
    create: "New order",
  },
};

const uk: OrdersCopy = {
  title: "Замовлення",
  createLabel: "Нове замовлення",
  filterLabel: "Фільтри",
  filterActiveLabel: "Фільтри, вибрано {{count}}",
  filterTitle: "Фільтри",
  filterStatus: "Статус замовлення",
  filterReset: "Скинути",
  filterApply: "Показати",
  closeSheet: "Закрити",
  statuses: {
    new: "Новий",
    confirmed: "Підтверджено",
    canceled: "Скасовано",
  },
  groups: {
    inProgress: "В роботі",
    completed: "Завершені",
  },
  groupCount: "{{title}} · {{count}}",
  items: {
    one: "{{count}} позиція",
    few: "{{count}} позиції",
    many: "{{count}} позицій",
  },
  missingCustomer: "Клієнт видалений",
  loadingLabel: "Завантаження замовлень",
  loadingMoreLabel: "Завантаження наступних замовлень",
  empty: {
    offlineTitle: "Немає зʼєднання",
    offlineDescription:
      "Список замовлень недоступний офлайн. Підключіться і спробуйте ще раз.",
    errorTitle: "Не вдалося завантажити замовлення",
    errorDescription: "Перевірте зʼєднання та спробуйте ще раз.",
    retry: "Повторити",
    filteredTitle: "Нічого не знайдено",
    filteredDescription: "Спробуйте змінити фільтри або скинути їх.",
    reset: "Скинути фільтри",
    catalogTitle: "Замовлень ще немає",
    catalogDescription:
      "Створіть перше замовлення вручну або попросіть асистента зробити це за вас.",
    create: "Нове замовлення",
  },
};

export function ordersCopy(locale: Locale): OrdersCopy {
  return locale === "uk" ? uk : en;
}
