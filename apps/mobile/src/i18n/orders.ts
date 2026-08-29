/** Orders list copy namespace (uk/en). Locale plumbing lives in `./locale`. */
import type { Locale } from "./locale";

export type OrdersCountForms = {
  readonly one: string;
  readonly few: string;
  readonly many: string;
};

export type OrdersDetailCopy = {
  readonly title: string;
  readonly backLabel: string;
  readonly loadingLabel: string;
  readonly offlineTitle: string;
  readonly offlineDescription: string;
  readonly errorTitle: string;
  readonly errorDescription: string;
  readonly retry: string;
  readonly notFoundTitle: string;
  readonly notFoundDescription: string;
  readonly notFoundAction: string;
  readonly customerTitle: string;
  readonly linesTitle: string;
  readonly commentTitle: string;
  readonly dueLabel: string;
  readonly confirmLabel: string;
  readonly cancelOrder: string;
  readonly actionsTitle: string;
  readonly actionsLabel: string;
  readonly mutationError: string;
  readonly mutationOffline: string;
  readonly mutationPermission: string;
};

export type OrdersCreateCopy = {
  readonly title: string;
  readonly backLabel: string;
  readonly placeholderTitle: string;
  readonly placeholderDescription: string;
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
  readonly detail: OrdersDetailCopy;
  readonly create: OrdersCreateCopy;
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
  detail: {
    title: "Order",
    backLabel: "Back",
    loadingLabel: "Loading order",
    offlineTitle: "No connection",
    offlineDescription:
      "Order details are unavailable offline. Connect and try again.",
    errorTitle: "Could not load the order",
    errorDescription: "Check your connection and try again.",
    retry: "Retry",
    notFoundTitle: "Order not found",
    notFoundDescription: "This order could not be found or is unavailable.",
    notFoundAction: "To the order list",
    customerTitle: "Customer",
    linesTitle: "Items",
    commentTitle: "Comment",
    dueLabel: "Due",
    confirmLabel: "Confirm",
    cancelOrder: "Cancel order",
    actionsTitle: "Actions",
    actionsLabel: "Order actions",
    mutationError: "Could not update the order. Try again.",
    mutationOffline: "No connection. Connect and try again.",
    mutationPermission: "You do not have permission to change this order.",
  },
  create: {
    title: "New order",
    backLabel: "Back",
    placeholderTitle: "Editor in development",
    placeholderDescription:
      "Creating an order from the phone is not available yet.",
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
  detail: {
    title: "Замовлення",
    backLabel: "Назад",
    loadingLabel: "Завантаження замовлення",
    offlineTitle: "Немає зʼєднання",
    offlineDescription:
      "Деталі замовлення недоступні офлайн. Підключіться і спробуйте ще раз.",
    errorTitle: "Не вдалося завантажити замовлення",
    errorDescription: "Перевірте зʼєднання та спробуйте ще раз.",
    retry: "Повторити",
    notFoundTitle: "Замовлення не знайдено",
    notFoundDescription: "Не вдалося знайти це замовлення або воно недоступне.",
    notFoundAction: "До списку замовлень",
    customerTitle: "Клієнт",
    linesTitle: "Позиції",
    commentTitle: "Коментар",
    dueLabel: "До сплати",
    confirmLabel: "Підтвердити",
    cancelOrder: "Скасувати замовлення",
    actionsTitle: "Швидкі дії",
    actionsLabel: "Дії з замовленням",
    mutationError: "Не вдалося оновити замовлення. Спробуйте ще раз.",
    mutationOffline: "Немає зʼєднання. Підключіться і спробуйте ще раз.",
    mutationPermission: "Немає дозволу змінювати це замовлення.",
  },
  create: {
    title: "Нове замовлення",
    backLabel: "Назад",
    placeholderTitle: "Редактор у розробці",
    placeholderDescription:
      "Створення замовлення з телефону поки недоступне.",
  },
};

export function ordersCopy(locale: Locale): OrdersCopy {
  return locale === "uk" ? uk : en;
}
