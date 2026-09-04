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
  readonly thumbnailUnavailable: string;
};

export type OrdersCreateErrorCopy = {
  readonly customerRequired: string;
  readonly itemsRequired: string;
  readonly itemsDuplicate: string;
  readonly itemsTooMany: string;
  readonly commentTooLong: string;
  readonly validation: string;
  readonly network: string;
  readonly offline: string;
  readonly unavailable: string;
  readonly permission: string;
};

export type OrdersCreateCopy = {
  readonly title: string;
  readonly itemsTitle: string;
  readonly addProductsLabel: string;
  readonly addProductsPlaceholder: string;
  readonly customerTitle: string;
  readonly customerLabel: string;
  readonly customerPlaceholder: string;
  readonly commentTitle: string;
  readonly commentLabel: string;
  readonly commentPlaceholder: string;
  readonly cancel: string;
  readonly leaveTitle: string;
  readonly leaveDescription: string;
  readonly leaveContinue: string;
  readonly leaveConfirm: string;
  readonly submitCreate: string;
  readonly submitCreateLoading: string;
  readonly permissionTitle: string;
  readonly permissionDescription: string;
  readonly customerSearchPlaceholder: string;
  readonly customerSearchLabel: string;
  readonly productSheetTitle: string;
  readonly productSearchPlaceholder: string;
  readonly productSearchLabel: string;
  readonly variantsBackLabel: string;
  readonly variantsLoading: string;
  readonly variantsError: string;
  readonly productSheetDone: string;
  readonly qtyDecrease: string;
  readonly qtyIncrease: string;
  readonly removeLine: string;
  readonly emptyCustomers: string;
  readonly emptyProducts: string;
  readonly emptyVariants: string;
  readonly customersError: string;
  readonly productsError: string;
  readonly lookupRetry: string;
  readonly thumbnailUnavailable: string;
  readonly errors: OrdersCreateErrorCopy;
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
  readonly create: OrdersCreateCopy;
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
    thumbnailUnavailable: "Photo unavailable",
  },
  create: {
    title: "New order",
    itemsTitle: "Items",
    addProductsLabel: "Products",
    addProductsPlaceholder: "Add products to the order",
    customerTitle: "Customer",
    customerLabel: "Customer",
    customerPlaceholder: "Choose a customer",
    commentTitle: "Comment",
    commentLabel: "For internal use",
    commentPlaceholder: "Customer requests, decoration details, and so on",
    cancel: "Cancel",
    leaveTitle: "Leave without saving?",
    leaveDescription: "Your changes will be lost.",
    leaveContinue: "Keep editing",
    leaveConfirm: "Leave without saving",
    submitCreate: "Create",
    submitCreateLoading: "Creating…",
    permissionTitle: "No permission",
    permissionDescription: "You do not have permission to create orders.",
    customerSearchPlaceholder: "Search customers…",
    customerSearchLabel: "Search customers",
    productSheetTitle: "Choose products",
    productSearchPlaceholder: "Search products…",
    productSearchLabel: "Search products",
    variantsBackLabel: "Back to products",
    variantsLoading: "Loading variants…",
    variantsError: "Could not load variants. Try again.",
    productSheetDone: "Done · {{count}}",
    qtyDecrease: "Decrease quantity",
    qtyIncrease: "Increase quantity",
    removeLine: "Remove {{name}}",
    emptyCustomers: "No active customers",
    emptyProducts: "No active products",
    emptyVariants: "No active variants",
    customersError: "Could not load customers. Try again.",
    productsError: "Could not load products. Try again.",
    lookupRetry: "Retry",
    thumbnailUnavailable: "Photo unavailable",
    errors: {
      customerRequired: "Choose a customer",
      itemsRequired: "Add at least one product",
      itemsDuplicate: "This product is already on the order.",
      itemsTooMany: "Too many lines. Maximum is 100.",
      commentTooLong: "Comment is too long",
      validation: "Check the fields and try again.",
      network: "Network error. Check your connection.",
      offline: "You're offline. Check your connection and try again.",
      unavailable: "Something went wrong. Try again.",
      permission: "You do not have permission to create orders.",
    },
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
    thumbnailUnavailable: "Фото недоступне",
  },
  create: {
    title: "Нове замовлення",
    itemsTitle: "Товари",
    addProductsLabel: "Товари",
    addProductsPlaceholder: "Додайте товари до замовлення",
    customerTitle: "Клієнт",
    customerLabel: "Клієнт",
    customerPlaceholder: "Оберіть клієнта",
    commentTitle: "Коментар",
    commentLabel: "Для внутрішнього використання",
    commentPlaceholder: "Побажання клієнта, деталі декору тощо",
    cancel: "Скасувати",
    leaveTitle: "Вийти без збереження?",
    leaveDescription: "Внесені зміни буде втрачено.",
    leaveContinue: "Продовжити редагування",
    leaveConfirm: "Вийти без збереження",
    submitCreate: "Створити",
    submitCreateLoading: "Створюємо…",
    permissionTitle: "Немає права",
    permissionDescription: "Немає права створювати замовлення.",
    customerSearchPlaceholder: "Пошук клієнтів…",
    customerSearchLabel: "Пошук клієнтів",
    productSheetTitle: "Оберіть товари",
    productSearchPlaceholder: "Пошук товарів…",
    productSearchLabel: "Пошук товарів",
    variantsBackLabel: "Назад до товарів",
    variantsLoading: "Завантажуємо варіанти…",
    variantsError: "Не вдалося завантажити варіанти. Спробуйте ще раз.",
    productSheetDone: "Готово · {{count}}",
    qtyDecrease: "Зменшити кількість",
    qtyIncrease: "Збільшити кількість",
    removeLine: "Видалити {{name}}",
    emptyCustomers: "Немає активних клієнтів",
    emptyProducts: "Немає активних товарів",
    emptyVariants: "Немає активних варіантів",
    customersError: "Не вдалося завантажити клієнтів. Спробуйте ще раз.",
    productsError: "Не вдалося завантажити товари. Спробуйте ще раз.",
    lookupRetry: "Повторити",
    thumbnailUnavailable: "Фото недоступне",
    errors: {
      customerRequired: "Оберіть клієнта",
      itemsRequired: "Додайте хоча б один товар",
      itemsDuplicate: "Цей товар уже є в замовленні.",
      itemsTooMany: "Забагато позицій. Максимум 100.",
      commentTooLong: "Коментар занадто довгий",
      validation: "Перевірте поля і спробуйте ще раз.",
      network: "Помилка мережі. Перевірте зʼєднання.",
      offline: "Немає зʼєднання. Підключіться і спробуйте ще раз.",
      unavailable: "Щось пішло не так. Спробуйте ще раз.",
      permission: "Немає права створювати замовлення.",
    },
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
