/** Products list copy namespace (uk/en). Locale plumbing lives in `./locale`. */
import type { Locale } from "./locale";

export type ProductsVariantForms = {
  readonly none: string;
  readonly one: string;
  readonly few: string;
  readonly many: string;
};

export type ProductsCopy = {
  readonly title: string;
  readonly searchLabel: string;
  readonly searchPlaceholder: string;
  readonly createLabel: string;
  readonly backLabel: string;
  readonly filters: {
    readonly all: string;
    readonly active: string;
    readonly archived: string;
  };
  readonly foundCount: string;
  readonly archivedBadge: string;
  readonly variants: ProductsVariantForms;
  readonly loadingLabel: string;
  readonly loadingMoreLabel: string;
  readonly empty: {
    readonly offlineTitle: string;
    readonly offlineDescription: string;
    readonly errorTitle: string;
    readonly errorDescription: string;
    readonly retry: string;
    readonly searchTitle: string;
    readonly searchDescription: string;
    readonly reset: string;
    readonly archivedTitle: string;
    readonly archivedDescription: string;
    readonly catalogTitle: string;
    readonly catalogDescription: string;
    readonly create: string;
    readonly activeTitle: string;
    readonly activeDescription: string;
    readonly showAll: string;
  };
  readonly stub: {
    readonly detailTitle: string;
    readonly createTitle: string;
  };
};

const en: ProductsCopy = {
  title: "Products",
  searchLabel: "Search products",
  searchPlaceholder: "Product name",
  createLabel: "New product",
  backLabel: "Back",
  filters: {
    all: "All",
    active: "Active",
    archived: "Archived",
  },
  foundCount: "Found · {{count}}",
  archivedBadge: "Archived",
  variants: {
    none: "No variants",
    one: "{{count}} variant",
    few: "{{count}} variants",
    many: "{{count}} variants",
  },
  loadingLabel: "Loading products",
  loadingMoreLabel: "Loading more products",
  empty: {
    offlineTitle: "No connection",
    offlineDescription:
      "The product list is unavailable offline. Connect and try again.",
    errorTitle: "Could not load products",
    errorDescription: "Check your connection and try again.",
    retry: "Retry",
    searchTitle: "Nothing found",
    searchDescription: "Change the search query or reset the search.",
    reset: "Reset",
    archivedTitle: "The archive is empty",
    archivedDescription:
      "Archived products stay in the list so old orders keep working.",
    catalogTitle: "No products yet",
    catalogDescription:
      "Create the first product manually or ask the AI assistant.",
    create: "New product",
    activeTitle: "No active products",
    activeDescription:
      "Restore a product from the archive or view all products.",
    showAll: "Show all",
  },
  stub: {
    detailTitle: "Product",
    createTitle: "New product",
  },
};

const uk: ProductsCopy = {
  title: "Товари",
  searchLabel: "Пошук товарів",
  searchPlaceholder: "Назва товару",
  createLabel: "Новий товар",
  backLabel: "Назад",
  filters: {
    all: "Усі",
    active: "Активні",
    archived: "Архівні",
  },
  foundCount: "Знайдено · {{count}}",
  archivedBadge: "Архівний",
  variants: {
    none: "Без варіантів",
    one: "{{count}} варіант",
    few: "{{count}} варіанти",
    many: "{{count}} варіантів",
  },
  loadingLabel: "Завантаження товарів",
  loadingMoreLabel: "Завантаження наступних товарів",
  empty: {
    offlineTitle: "Немає зʼєднання",
    offlineDescription:
      "Список товарів недоступний офлайн. Підключіться і спробуйте ще раз.",
    errorTitle: "Не вдалося завантажити товари",
    errorDescription: "Перевірте з’єднання та спробуйте ще раз.",
    retry: "Повторити",
    searchTitle: "Нічого не знайдено",
    searchDescription: "Змініть пошуковий запит або скиньте пошук.",
    reset: "Скинути",
    archivedTitle: "Архів порожній",
    archivedDescription:
      "Архівні товари залишаються у списку, щоб не ламати старі замовлення.",
    catalogTitle: "Товарів ще немає",
    catalogDescription:
      "Створіть перший товар вручну або попросіть AI-асистента.",
    create: "Новий товар",
    activeTitle: "Активних товарів немає",
    activeDescription: "Поверніть товар з архіву або перегляньте всі товари.",
    showAll: "Показати всі",
  },
  stub: {
    detailTitle: "Товар",
    createTitle: "Новий товар",
  },
};

export function productsCopy(locale: Locale): ProductsCopy {
  return locale === "uk" ? uk : en;
}
