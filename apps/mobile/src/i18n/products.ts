/** Products list + detail copy namespace (uk/en). Locale plumbing lives in `./locale`. */
import type { Locale } from "./locale";

export type ProductsVariantForms = {
  readonly none: string;
  readonly one: string;
  readonly few: string;
  readonly many: string;
};

export type ProductsFormCopy = {
  readonly nameLabel: string;
  readonly namePlaceholder: string;
  readonly priceLabel: string;
  readonly pricePlaceholder: string;
  readonly variantsTitle: string;
  readonly addVariant: string;
  readonly removeVariant: string;
  readonly variantNameLabel: string;
  readonly variantNamePlaceholder: string;
  readonly variantPriceLabel: string;
  readonly variantPricePlaceholder: string;
  readonly inheritHint: string;
  readonly submitCreate: string;
  readonly submitCreateLoading: string;
  readonly submitEdit: string;
  readonly submitEditLoading: string;
  readonly permissionCreateTitle: string;
  readonly permissionCreateDescription: string;
  readonly permissionEditTitle: string;
  readonly permissionEditDescription: string;
  readonly errors: {
    readonly nameRequired: string;
    readonly nameTooLong: string;
    readonly priceRequired: string;
    readonly priceInvalid: string;
    readonly validation: string;
    readonly network: string;
    readonly offline: string;
    readonly unavailable: string;
    readonly permission: string;
    readonly tooManyVariants: string;
  };
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

export type ProductsPhotosCopy = {
  readonly title: string;
  readonly addLabel: string;
  readonly addCamera: string;
  readonly addLibrary: string;
  readonly coverLabel: string;
  readonly removeLabel: string;
  readonly moveEarlier: string;
  readonly moveLater: string;
  readonly retryLabel: string;
  readonly cancelUpload: string;
  readonly uploadingLabel: string;
  readonly failedLabel: string;
  readonly emptyTitle: string;
  readonly emptyDescription: string;
  readonly pickTitle: string;
  readonly pickDescription: string;
  readonly permissionTitle: string;
  readonly permissionDescription: string;
  readonly cameraDeniedTitle: string;
  readonly cameraDeniedDescription: string;
  readonly libraryDeniedTitle: string;
  readonly libraryDeniedDescription: string;
  readonly closeSheet: string;
  readonly errors: {
    readonly network: string;
    readonly offline: string;
    readonly unavailable: string;
    readonly permission: string;
    readonly validation: string;
    readonly too_many: string;
    readonly commit: string;
  };
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
  readonly form: ProductsFormCopy;
  readonly detail: ProductsDetailCopy;
  readonly photos: ProductsPhotosCopy;
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
  form: {
    nameLabel: "Name",
    namePlaceholder: "Product name",
    priceLabel: "Base price",
    pricePlaceholder: "0",
    variantsTitle: "Variants",
    addVariant: "Add variant",
    removeVariant: "Remove",
    variantNameLabel: "Variant name",
    variantNamePlaceholder: "For example, 1 kg",
    variantPriceLabel: "Price",
    variantPricePlaceholder: "Base price",
    inheritHint: "Empty price uses the product price",
    submitCreate: "Create product",
    submitCreateLoading: "Creating…",
    submitEdit: "Save",
    submitEditLoading: "Saving…",
    permissionCreateTitle: "No permission",
    permissionCreateDescription:
      "You do not have permission to create products.",
    permissionEditTitle: "No permission",
    permissionEditDescription:
      "You do not have permission to change this product.",
    errors: {
      nameRequired: "Enter a name",
      nameTooLong: "Name is too long",
      priceRequired: "Enter a price",
      priceInvalid: "Check the price",
      validation: "Check the fields and try again.",
      network: "Network error. Check your connection.",
      offline: "You're offline. Check your connection and try again.",
      unavailable: "Something went wrong. Try again.",
      permission: "You do not have permission to change this product.",
      tooManyVariants: "Too many variants. Maximum is 100.",
    },
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
  photos: {
    title: "Photos",
    addLabel: "Add photo",
    addCamera: "Camera",
    addLibrary: "Photo library",
    coverLabel: "Cover",
    removeLabel: "Remove photo",
    moveEarlier: "Move earlier",
    moveLater: "Move later",
    retryLabel: "Retry",
    cancelUpload: "Cancel upload",
    uploadingLabel: "Uploading",
    failedLabel: "Could not upload",
    emptyTitle: "No photos",
    emptyDescription: "Add photos from the camera or the photo library.",
    pickTitle: "Add a photo",
    pickDescription: "Choose the camera or the photo library.",
    permissionTitle: "No permission",
    permissionDescription: "You do not have permission to change these photos.",
    cameraDeniedTitle: "No camera access",
    cameraDeniedDescription:
      "Allow camera access in system settings to take product photos.",
    libraryDeniedTitle: "No photo access",
    libraryDeniedDescription:
      "Allow photo library access in system settings to attach product images.",
    closeSheet: "Cancel",
    errors: {
      network: "Network error. Check your connection.",
      offline: "You're offline. Check your connection and try again.",
      unavailable: "Something went wrong. Try again.",
      permission: "You do not have permission to change these photos.",
      validation: "This image cannot be attached. Try another photo.",
      too_many: "Too many photos. Maximum is 10.",
      commit: "Could not save the photo list. Try again.",
    },
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
  form: {
    nameLabel: "Назва",
    namePlaceholder: "Назва товару",
    priceLabel: "Базова ціна",
    pricePlaceholder: "0",
    variantsTitle: "Варіанти",
    addVariant: "Додати варіант",
    removeVariant: "Видалити",
    variantNameLabel: "Назва варіанта",
    variantNamePlaceholder: "Наприклад, 1 кг",
    variantPriceLabel: "Ціна",
    variantPricePlaceholder: "Базова ціна",
    inheritHint: "Порожня ціна — як у товару",
    submitCreate: "Створити товар",
    submitCreateLoading: "Створюємо…",
    submitEdit: "Зберегти",
    submitEditLoading: "Зберігаємо…",
    permissionCreateTitle: "Немає права",
    permissionCreateDescription: "Немає права створювати товари.",
    permissionEditTitle: "Немає права",
    permissionEditDescription: "Немає права змінювати цей товар.",
    errors: {
      nameRequired: "Вкажіть назву",
      nameTooLong: "Назва занадто довга",
      priceRequired: "Вкажіть ціну",
      priceInvalid: "Перевірте ціну",
      validation: "Перевірте поля і спробуйте ще раз.",
      network: "Помилка мережі. Перевірте з’єднання.",
      offline: "Немає зʼєднання. Підключіться і спробуйте ще раз.",
      unavailable: "Щось пішло не так. Спробуйте ще раз.",
      permission: "Немає права змінювати цей товар.",
      tooManyVariants: "Забагато варіантів. Максимум 100.",
    },
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
  photos: {
    title: "Фото",
    addLabel: "Додати фото",
    addCamera: "Камера",
    addLibrary: "Галерея",
    coverLabel: "Обкладинка",
    removeLabel: "Видалити фото",
    moveEarlier: "Перемістити ліворуч",
    moveLater: "Перемістити праворуч",
    retryLabel: "Повторити",
    cancelUpload: "Скасувати завантаження",
    uploadingLabel: "Завантаження",
    failedLabel: "Не вдалося завантажити",
    emptyTitle: "Немає фото",
    emptyDescription: "Додайте фото з камери або галереї.",
    pickTitle: "Додати фото",
    pickDescription: "Оберіть камеру або галерею.",
    permissionTitle: "Немає права",
    permissionDescription: "Немає права змінювати фото цього товару.",
    cameraDeniedTitle: "Немає доступу до камери",
    cameraDeniedDescription:
      "Дозвольте доступ до камери в налаштуваннях системи, щоб знімати фото товару.",
    libraryDeniedTitle: "Немає доступу до фото",
    libraryDeniedDescription:
      "Дозвольте доступ до фото в налаштуваннях системи, щоб додати зображення товару.",
    closeSheet: "Скасувати",
    errors: {
      network: "Помилка мережі. Перевірте з’єднання.",
      offline: "Немає зʼєднання. Підключіться і спробуйте ще раз.",
      unavailable: "Щось пішло не так. Спробуйте ще раз.",
      permission: "Немає права змінювати фото цього товару.",
      validation: "Це зображення не можна додати. Спробуйте інше фото.",
      too_many: "Забагато фото. Максимум 10.",
      commit: "Не вдалося зберегти список фото. Спробуйте ще раз.",
    },
  },
};

export function productsCopy(locale: Locale): ProductsCopy {
  return locale === "uk" ? uk : en;
}
