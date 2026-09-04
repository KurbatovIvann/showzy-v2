/** Orders list copy namespace (uk/en). Locale plumbing lives in `./locale`. */
import {
  formChromeEn,
  formChromeUk,
  selectCopy,
  type CountForms,
  type FormChromeCopy,
  type WriteErrorsCopy,
} from "./copy";
import type { Locale } from "./locale";

export type OrdersCountForms = CountForms;

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
  readonly startLabel: string;
  readonly completeLabel: string;
  readonly cancelOrder: string;
  readonly actionsTitle: string;
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
  readonly itemsVariantRequired: string;
  readonly itemsNoActiveVariants: string;
  readonly commentTooLong: string;
} & WriteErrorsCopy;

export type OrdersCreateCopy = Omit<
  FormChromeCopy,
  "changedLabel" | "closeSheet" | "submitEdit" | "submitEditLoading"
> & {
  readonly title: string;
  readonly backLabel: string;
  readonly itemsTitle: string;
  readonly addProductsLabel: string;
  readonly addProductsPlaceholder: string;
  readonly addProductsValue: string;
  readonly customerTitle: string;
  readonly customerLabel: string;
  readonly customerPlaceholder: string;
  readonly commentTitle: string;
  readonly commentLabel: string;
  readonly commentPlaceholder: string;
  readonly permissionTitle: string;
  readonly permissionDescription: string;
  readonly customerSheetTitle: string;
  readonly customerSearchPlaceholder: string;
  readonly customerSearchLabel: string;
  readonly productSheetTitle: string;
  readonly productSearchPlaceholder: string;
  readonly productSearchLabel: string;
  readonly variantsBackLabel: string;
  readonly variantsLoading: string;
  readonly variantsError: string;
  readonly variantsSelected: string;
  readonly productSheetDone: string;
  readonly thumbnailUnavailable: string;
  readonly qtyDecrease: string;
  readonly qtyIncrease: string;
  readonly removeLine: string;
  readonly variantsNone: string;
  readonly variants: OrdersCountForms;
  readonly emptyCustomers: string;
  readonly emptyProducts: string;
  readonly emptyVariants: string;
  readonly emptyPositions: string;
  readonly errors: OrdersCreateErrorCopy;
};

export type OrdersCopy = {
  readonly title: string;
  readonly createLabel: string;
  readonly searchLabel: string;
  readonly searchPlaceholder: string;
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
  searchLabel: "Search orders",
  searchPlaceholder: "Number, customer or phone",
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
  loadingMoreLabel: "Loading more orders",
  empty: {
    offlineTitle: "No connection",
    offlineDescription:
      "The order list is unavailable offline. Connect and try again.",
    errorTitle: "Could not load orders",
    errorDescription: "Check your connection and try again.",
    retry: "Retry",
    filteredTitle: "Nothing found",
    filteredDescription: "Change the search or filters, or reset them.",
    reset: "Reset search and filters",
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
    startLabel: "Start",
    completeLabel: "Complete",
    cancelOrder: "Cancel order",
    actionsTitle: "Actions",
    actionsLabel: "Order actions",
    mutationError: "Could not update the order. Try again.",
    mutationOffline: "No connection. Connect and try again.",
    mutationPermission: "You do not have permission to change this order.",
    thumbnailUnavailable: "Photo unavailable",
  },
  create: {
    title: "New order",
    backLabel: "Back",
    itemsTitle: "Items",
    addProductsLabel: "Products",
    addProductsPlaceholder: "Add products to the order",
    addProductsValue: "{{count}} in the order",
    customerTitle: "Customer",
    customerLabel: "Customer",
    customerPlaceholder: "Choose a customer",
    commentTitle: "Comment",
    commentLabel: "For internal use",
    commentPlaceholder: "Customer requests, decoration details, and so on",
    ...formChromeEn,
    submitCreateLoading: "Creating…",
    permissionTitle: "No permission",
    permissionDescription: "You do not have permission to create orders.",
    customerSheetTitle: "Choose a customer",
    customerSearchPlaceholder: "Search customers…",
    customerSearchLabel: "Search customers",
    productSheetTitle: "Choose products",
    productSearchPlaceholder: "Search products…",
    productSearchLabel: "Search products",
    variantsBackLabel: "Back to products",
    variantsLoading: "Loading variants…",
    variantsError: "Could not load variants. Try again.",
    variantsSelected: "{{count}} selected · {{names}}",
    productSheetDone: "Done · {{count}}",
    thumbnailUnavailable: "Photo unavailable",
    qtyDecrease: "Decrease quantity",
    qtyIncrease: "Increase quantity",
    removeLine: "Remove {{name}}",
    variantsNone: "No variants",
    variants: {
      one: "{{count}} variant",
      few: "{{count}} variants",
      many: "{{count}} variants",
    },
    emptyCustomers: "No active customers",
    emptyProducts: "No active products",
    emptyVariants: "No active variants",
    emptyPositions: "No items",
    errors: {
      customerRequired: "Choose a customer",
      itemsRequired: "Add at least one product",
      itemsDuplicate: "This product is already on the order.",
      itemsTooMany: "Too many lines. Maximum is 100.",
      itemsVariantRequired: "Choose a variant",
      itemsNoActiveVariants: "This product has no active variants",
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
  createLabel: "Нове замовлення",
  searchLabel: "Пошук замовлень",
  searchPlaceholder: "Номер, клієнт або телефон",
  filterLabel: "Фільтри",
  filterActiveLabel: "Фільтри, вибрано {{count}}",
  filterTitle: "Фільтри",
  filterStatus: "Статус замовлення",
  filterReset: "Скинути",
  filterApply: "Показати",
  closeSheet: "Закрити",
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
  loadingMoreLabel: "Завантаження наступних замовлень",
  empty: {
    offlineTitle: "Немає зʼєднання",
    offlineDescription:
      "Список замовлень недоступний офлайн. Підключіться і спробуйте ще раз.",
    errorTitle: "Не вдалося завантажити замовлення",
    errorDescription: "Перевірте зʼєднання та спробуйте ще раз.",
    retry: "Повторити",
    filteredTitle: "Нічого не знайдено",
    filteredDescription: "Спробуйте змінити пошук чи фільтри або скинути їх.",
    reset: "Скинути пошук і фільтри",
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
    startLabel: "В роботу",
    completeLabel: "Виконано",
    cancelOrder: "Скасувати замовлення",
    actionsTitle: "Швидкі дії",
    actionsLabel: "Дії з замовленням",
    mutationError: "Не вдалося оновити замовлення. Спробуйте ще раз.",
    mutationOffline: "Немає зʼєднання. Підключіться і спробуйте ще раз.",
    mutationPermission: "Немає дозволу змінювати це замовлення.",
    thumbnailUnavailable: "Фото недоступне",
  },
  create: {
    title: "Нове замовлення",
    backLabel: "Назад",
    itemsTitle: "Товари",
    addProductsLabel: "Товари",
    addProductsPlaceholder: "Додайте товари до замовлення",
    addProductsValue: "{{count}} у замовленні",
    customerTitle: "Клієнт",
    customerLabel: "Клієнт",
    customerPlaceholder: "Оберіть клієнта",
    commentTitle: "Коментар",
    commentLabel: "Для внутрішнього використання",
    commentPlaceholder: "Побажання клієнта, деталі декору тощо",
    ...formChromeUk,
    submitCreateLoading: "Створюємо…",
    permissionTitle: "Немає права",
    permissionDescription: "Немає права створювати замовлення.",
    customerSheetTitle: "Оберіть клієнта",
    customerSearchPlaceholder: "Пошук клієнтів…",
    customerSearchLabel: "Пошук клієнтів",
    productSheetTitle: "Оберіть товари",
    productSearchPlaceholder: "Пошук товарів…",
    productSearchLabel: "Пошук товарів",
    variantsBackLabel: "Назад до товарів",
    variantsLoading: "Завантажуємо варіанти…",
    variantsError: "Не вдалося завантажити варіанти. Спробуйте ще раз.",
    variantsSelected: "{{count}} вибрано · {{names}}",
    productSheetDone: "Готово · {{count}}",
    thumbnailUnavailable: "Фото недоступне",
    qtyDecrease: "Зменшити кількість",
    qtyIncrease: "Збільшити кількість",
    removeLine: "Видалити {{name}}",
    variantsNone: "Без варіантів",
    variants: {
      one: "{{count}} варіант",
      few: "{{count}} варіанти",
      many: "{{count}} варіантів",
    },
    emptyCustomers: "Немає активних клієнтів",
    emptyProducts: "Немає активних товарів",
    emptyVariants: "Немає активних варіантів",
    emptyPositions: "Без позицій",
    errors: {
      customerRequired: "Оберіть клієнта",
      itemsRequired: "Додайте хоча б один товар",
      itemsDuplicate: "Цей товар уже є в замовленні.",
      itemsTooMany: "Забагато позицій. Максимум 100.",
      itemsVariantRequired: "Оберіть варіант",
      itemsNoActiveVariants: "У цього товару немає активних варіантів",
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
  return selectCopy(locale, { uk, en });
}
