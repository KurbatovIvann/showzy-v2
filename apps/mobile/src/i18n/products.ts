/** Products list + detail copy namespace (uk/en). Locale plumbing lives in `./locale`. */
import type { Locale } from "./locale";

export type ProductsVariantForms = {
  readonly none: string;
  readonly one: string;
  readonly few: string;
  readonly many: string;
};

export type ProductsDetailCopy = {
  readonly title: string;
  readonly loadingLabel: string;
  readonly offlineTitle: string;
  readonly offlineDescription: string;
  readonly errorTitle: string;
  readonly errorDescription: string;
  readonly retry: string;
  readonly notFoundTitle: string;
  readonly notFoundDescription: string;
  readonly variantsTitle: string;
  readonly noPhotos: string;
  readonly photosLabel: string;
  readonly photosManageLabel: string;
  readonly editLabel: string;
  readonly inheritedPrice: string;
  readonly archiveProduct: string;
  readonly restoreProduct: string;
  readonly archiveVariant: string;
  readonly restoreVariant: string;
  readonly archiveVariantNamed: string;
  readonly restoreVariantNamed: string;
  readonly confirmArchiveProductTitle: string;
  readonly confirmArchiveProductDescription: string;
  readonly confirmRestoreProductTitle: string;
  readonly confirmRestoreProductDescription: string;
  readonly confirmArchiveVariantTitle: string;
  readonly confirmArchiveVariantDescription: string;
  readonly confirmRestoreVariantTitle: string;
  readonly confirmRestoreVariantDescription: string;
  readonly cancel: string;
  readonly mutationError: string;
  readonly mutationOffline: string;
  readonly mutationPermission: string;
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
    readonly createTitle: string;
    readonly editTitle: string;
    readonly photosTitle: string;
  };
  readonly detail: ProductsDetailCopy;
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
    createTitle: "New product",
    editTitle: "Edit product",
    photosTitle: "Photos",
  },
  detail: {
    title: "Product",
    loadingLabel: "Loading product",
    offlineTitle: "No connection",
    offlineDescription:
      "Product details are unavailable offline. Connect and try again.",
    errorTitle: "Could not load the product",
    errorDescription: "Check your connection and try again.",
    retry: "Retry",
    notFoundTitle: "Product not found",
    notFoundDescription: "This product could not be found or is unavailable.",
    variantsTitle: "Variants",
    noPhotos: "No photos",
    photosLabel: "Photos",
    photosManageLabel: "Manage photos",
    editLabel: "Edit",
    inheritedPrice: "Base price",
    archiveProduct: "Archive product",
    restoreProduct: "Restore from archive",
    archiveVariant: "Archive",
    restoreVariant: "Restore",
    archiveVariantNamed: "Archive variant «{{name}}»",
    restoreVariantNamed: "Restore variant «{{name}}»",
    confirmArchiveProductTitle: "Archive this product?",
    confirmArchiveProductDescription:
      "The product will leave sale. Variants keep their own status. Existing orders stay valid.",
    confirmRestoreProductTitle: "Restore this product?",
    confirmRestoreProductDescription:
      "The product will be available for sale again.",
    confirmArchiveVariantTitle: "Archive this variant?",
    confirmArchiveVariantDescription:
      "Variant «{{name}}» will leave sale. The product status does not change.",
    confirmRestoreVariantTitle: "Restore this variant?",
    confirmRestoreVariantDescription:
      "Variant «{{name}}» will be available for sale again.",
    cancel: "Cancel",
    mutationError: "Could not update status. Try again.",
    mutationOffline: "No connection. Connect and try again.",
    mutationPermission: "You do not have permission to change this product.",
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
    createTitle: "Новий товар",
    editTitle: "Редагування товару",
    photosTitle: "Фото",
  },
  detail: {
    title: "Товар",
    loadingLabel: "Завантаження товару",
    offlineTitle: "Немає зʼєднання",
    offlineDescription:
      "Картка товару недоступна офлайн. Підключіться і спробуйте ще раз.",
    errorTitle: "Не вдалося завантажити товар",
    errorDescription: "Перевірте з’єднання та спробуйте ще раз.",
    retry: "Повторити",
    notFoundTitle: "Товар не знайдено",
    notFoundDescription: "Не вдалося знайти цей товар або він недоступний.",
    variantsTitle: "Варіанти",
    noPhotos: "Немає фото",
    photosLabel: "Фото",
    photosManageLabel: "Керувати фото",
    editLabel: "Редагувати",
    inheritedPrice: "Базова ціна",
    archiveProduct: "Архівувати товар",
    restoreProduct: "Повернути з архіву",
    archiveVariant: "Архівувати",
    restoreVariant: "Повернути",
    archiveVariantNamed: "Архівувати варіант «{{name}}»",
    restoreVariantNamed: "Повернути варіант «{{name}}»",
    confirmArchiveProductTitle: "Архівувати товар?",
    confirmArchiveProductDescription:
      "Товар зникне з продажу. Статус варіантів не зміниться. Старі замовлення залишаться чинними.",
    confirmRestoreProductTitle: "Повернути товар?",
    confirmRestoreProductDescription: "Товар знову буде доступний для продажу.",
    confirmArchiveVariantTitle: "Архівувати варіант?",
    confirmArchiveVariantDescription:
      "Варіант «{{name}}» зникне з продажу. Статус товару не зміниться.",
    confirmRestoreVariantTitle: "Повернути варіант?",
    confirmRestoreVariantDescription:
      "Варіант «{{name}}» знову буде доступний для продажу.",
    cancel: "Скасувати",
    mutationError: "Не вдалося змінити статус. Спробуйте ще раз.",
    mutationOffline: "Немає зʼєднання. Підключіться і спробуйте ще раз.",
    mutationPermission: "Немає права змінювати цей товар.",
  },
};

export function productsCopy(locale: Locale): ProductsCopy {
  return locale === "uk" ? uk : en;
}
