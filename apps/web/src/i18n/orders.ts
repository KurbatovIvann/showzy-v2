/** Orders list copy namespace (uk/en). Locale plumbing lives in `./locale`. */
import { interpolate, type Locale } from "./locale";
import type { CountForms } from "./plural";

export type OrdersCountForms = CountForms;

export type OrdersDetailCopy = {
  readonly title: string;
  readonly loadingLabel: string;
  readonly errorTitle: string;
  readonly errorDescription: string;
  readonly retry: string;
  readonly notFoundTitle: string;
  readonly notFoundDescription: string;
  readonly customerTitle: string;
  readonly linesTitle: string;
  readonly commentTitle: string;
  readonly dueLabel: string;
  readonly confirmLabel: string;
  readonly startLabel: string;
  readonly completeLabel: string;
  readonly cancelOrder: string;
  readonly actionsLabel: string;
  readonly mutationError: string;
  readonly mutationOffline: string;
  readonly mutationPermission: string;
};

export type OrdersCopy = {
  readonly title: string;
  readonly createLabel: string;
  readonly searchLabel: string;
  readonly searchPlaceholder: string;
  readonly filterAll: string;
  readonly filterStatus: string;
  readonly statuses: {
    readonly new: string;
    readonly confirmed: string;
    readonly in_progress: string;
    readonly done: string;
    readonly canceled: string;
  };
  readonly groups: {
    readonly active: string;
    readonly closed: string;
  };
  readonly groupCount: string;
  readonly items: OrdersCountForms;
  readonly missingCustomer: string;
  readonly loadingLabel: string;
  readonly emptySelection: string;
  readonly empty: {
    readonly errorTitle: string;
    readonly errorDescription: string;
    readonly retry: string;
    readonly filteredTitle: string;
    readonly filteredDescription: string;
    readonly reset: string;
    readonly catalogTitle: string;
    readonly catalogDescription: string;
  };
  readonly detail: OrdersDetailCopy;
};

const en: OrdersCopy = {
  title: "Orders",
  createLabel: "+ New",
  searchLabel: "Search orders",
  searchPlaceholder: "Number, customer or phone",
  filterAll: "All",
  filterStatus: "Order status",
  statuses: {
    new: "New",
    confirmed: "Confirmed",
    in_progress: "In progress",
    done: "Done",
    canceled: "Canceled",
  },
  groups: {
    active: "Active",
    closed: "Closed",
  },
  groupCount: "{{title}} · {{count}}",
  items: {
    one: "{{count}} item",
    few: "{{count}} items",
    many: "{{count}} items",
  },
  missingCustomer: "Deleted customer",
  loadingLabel: "Loading orders",
  emptySelection: "Select an item",
  empty: {
    errorTitle: "Could not load orders",
    errorDescription: "Check your connection and try again.",
    retry: "Retry",
    filteredTitle: "Nothing found",
    filteredDescription: "Change the search or filters, or reset them.",
    reset: "Reset search and filters",
    catalogTitle: "No orders yet",
    catalogDescription: "Create the first order with + New.",
  },
  detail: {
    title: "Order",
    loadingLabel: "Loading order",
    errorTitle: "Could not load the order",
    errorDescription: "Check your connection and try again.",
    retry: "Retry",
    notFoundTitle: "Order not found",
    notFoundDescription: "This order could not be found or is unavailable.",
    customerTitle: "Customer",
    linesTitle: "Items",
    commentTitle: "Comment",
    dueLabel: "Due",
    confirmLabel: "Confirm",
    startLabel: "Start",
    completeLabel: "Done",
    cancelOrder: "Cancel",
    actionsLabel: "Order actions",
    mutationError: "Could not update the order. Try again.",
    mutationOffline: "No connection. Connect and try again.",
    mutationPermission: "You do not have permission to change this order.",
  },
};

const uk: OrdersCopy = {
  title: "Замовлення",
  createLabel: "+ Нове",
  searchLabel: "Пошук замовлень",
  searchPlaceholder: "Номер, клієнт або телефон",
  filterAll: "Усі",
  filterStatus: "Статус замовлення",
  statuses: {
    new: "Нове",
    confirmed: "Підтверджено",
    in_progress: "В роботі",
    done: "Виконано",
    canceled: "Скасовано",
  },
  groups: {
    active: "Активні",
    closed: "Закриті",
  },
  groupCount: "{{title}} · {{count}}",
  items: {
    one: "{{count}} позиція",
    few: "{{count}} позиції",
    many: "{{count}} позицій",
  },
  missingCustomer: "Клієнт видалений",
  loadingLabel: "Завантаження замовлень",
  emptySelection: "Оберіть елемент",
  empty: {
    errorTitle: "Не вдалося завантажити замовлення",
    errorDescription: "Перевірте зʼєднання та спробуйте ще раз.",
    retry: "Повторити",
    filteredTitle: "Нічого не знайдено",
    filteredDescription: "Спробуйте змінити пошук чи фільтри або скинути їх.",
    reset: "Скинути пошук і фільтри",
    catalogTitle: "Замовлень ще немає",
    catalogDescription: "Створіть перше замовлення кнопкою + Нове.",
  },
  detail: {
    title: "Замовлення",
    loadingLabel: "Завантаження замовлення",
    errorTitle: "Не вдалося завантажити замовлення",
    errorDescription: "Перевірте зʼєднання та спробуйте ще раз.",
    retry: "Повторити",
    notFoundTitle: "Замовлення не знайдено",
    notFoundDescription: "Не вдалося знайти це замовлення або воно недоступне.",
    customerTitle: "Клієнт",
    linesTitle: "Позиції",
    commentTitle: "Коментар",
    dueLabel: "До сплати",
    confirmLabel: "Підтвердити",
    startLabel: "В роботу",
    completeLabel: "Виконано",
    cancelOrder: "Скасувати",
    actionsLabel: "Дії з замовленням",
    mutationError: "Не вдалося оновити замовлення. Спробуйте ще раз.",
    mutationOffline: "Немає зʼєднання. Підключіться і спробуйте ще раз.",
    mutationPermission: "Немає дозволу змінювати це замовлення.",
  },
};

export function ordersCopy(locale: Locale): OrdersCopy {
  return locale === "uk" ? uk : en;
}

export function orderGroupCountLabel(
  copy: OrdersCopy,
  key: "active" | "closed",
  count: number,
): string {
  return interpolate(copy.groupCount, {
    title: copy.groups[key],
    count: String(count),
  });
}
