/** Price-lists list copy namespace (uk/en). Locale plumbing lives in `./locale`. */
import type { Locale } from "./locale";

export type PricingCountForms = {
  readonly none: string;
  readonly one: string;
  readonly few: string;
  readonly many: string;
};

export type PricingMutationCopy = {
  readonly error: string;
  readonly offline: string;
  readonly permission: string;
};

export type PricingEmptyCopy = {
  readonly offlineTitle: string;
  readonly offlineDescription: string;
  readonly errorTitle: string;
  readonly errorDescription: string;
  readonly retry: string;
  readonly searchTitle: string;
  readonly searchDescription: string;
  readonly reset: string;
  readonly catalogTitle: string;
  readonly catalogDescription: string;
  readonly create: string;
};

export type PricingEditorStubCopy = {
  readonly createTitle: string;
  readonly editTitle: string;
  readonly placeholderTitle: string;
  readonly placeholderDescription: string;
  readonly notFoundTitle: string;
  readonly notFoundDescription: string;
};

export type PricingCopy = {
  readonly title: string;
  readonly searchLabel: string;
  readonly searchPlaceholder: string;
  readonly createLabel: string;
  readonly backLabel: string;
  readonly editLabel: string;
  readonly optionsLabel: string;
  readonly defaultBadge: string;
  readonly inactiveBadge: string;
  readonly loadingLabel: string;
  readonly loadingMoreLabel: string;
  readonly hint: string;
  readonly filters: {
    readonly all: string;
    readonly active: string;
    readonly inactive: string;
  };
  readonly prices: PricingCountForms;
  readonly empty: PricingEmptyCopy;
  readonly options: {
    readonly setDefault: string;
    readonly clearDefault: string;
    readonly activate: string;
    readonly deactivate: string;
    readonly delete: string;
    readonly close: string;
  };
  readonly confirm: {
    readonly deleteTitle: string;
    readonly deleteDescription: string;
    readonly deleteConfirm: string;
    readonly cancel: string;
  };
  readonly toast: {
    readonly cannotDeactivateDefault: string;
  };
  readonly mutation: PricingMutationCopy;
  readonly stub: PricingEditorStubCopy;
};

const en: PricingCopy = {
  title: "Price lists",
  searchLabel: "Search price lists",
  searchPlaceholder: "Name",
  createLabel: "New price list",
  backLabel: "Back",
  editLabel: "Edit",
  optionsLabel: "Options for {{name}}",
  defaultBadge: "Default",
  inactiveBadge: "Inactive",
  loadingLabel: "Loading price lists",
  loadingMoreLabel: "Loading more",
  hint: "Customers and groups take prices from their assigned list. If none — from the default, then the catalog.",
  filters: {
    all: "All",
    active: "Active",
    inactive: "Inactive",
  },
  prices: {
    none: "No separate prices",
    one: "{{count}} price",
    few: "{{count}} prices",
    many: "{{count}} prices",
  },
  empty: {
    offlineTitle: "No connection",
    offlineDescription: "Check the network and try again.",
    errorTitle: "Could not load price lists",
    errorDescription: "Something went wrong. Try again.",
    retry: "Retry",
    searchTitle: "Nothing found",
    searchDescription: "Change the search or show all price lists.",
    reset: "Reset",
    catalogTitle: "No price lists yet",
    catalogDescription:
      "Create separate prices for wholesale, partners, or seasonal offers.",
    create: "New price list",
  },
  options: {
    setDefault: "Make default",
    clearDefault: "Remove “default” mark",
    activate: "Activate",
    deactivate: "Deactivate",
    delete: "Delete",
    close: "Close",
  },
  confirm: {
    deleteTitle: "Delete this price list?",
    deleteDescription:
      "“{{name}}” and all of its prices will be deleted. Assigned customers and groups will fall back to the next price level.",
    deleteConfirm: "Delete",
    cancel: "Cancel",
  },
  toast: {
    cannotDeactivateDefault: "Assign another default price list first",
  },
  mutation: {
    error: "Could not update the price list. Try again.",
    offline: "No connection. Try again when you are online.",
    permission: "You do not have permission to change price lists.",
  },
  stub: {
    createTitle: "New price list",
    editTitle: "Edit price list",
    placeholderTitle: "Editor coming soon",
    placeholderDescription:
      "Creating lists and filling product prices will land in the next step.",
    notFoundTitle: "Price list not found",
    notFoundDescription: "This price list could not be found or is unavailable.",
  },
};

const uk: PricingCopy = {
  title: "Прайс-листи",
  searchLabel: "Пошук прайс-листів",
  searchPlaceholder: "Назва",
  createLabel: "Новий прайс-лист",
  backLabel: "Назад",
  editLabel: "Редагувати",
  optionsLabel: "Опції {{name}}",
  defaultBadge: "Основний",
  inactiveBadge: "Неактивний",
  loadingLabel: "Завантаження прайс-листів",
  loadingMoreLabel: "Завантаження ще",
  hint: "Клієнти й групи беруть ціни з призначеного листа. Якщо його немає — з основного, далі з каталогу.",
  filters: {
    all: "Усі",
    active: "Активні",
    inactive: "Неактивні",
  },
  prices: {
    none: "Без окремих цін",
    one: "{{count}} ціна",
    few: "{{count}} ціни",
    many: "{{count}} цін",
  },
  empty: {
    offlineTitle: "Немає зʼєднання",
    offlineDescription: "Перевірте мережу і спробуйте ще раз.",
    errorTitle: "Не вдалося завантажити прайс-листи",
    errorDescription: "Щось пішло не так. Спробуйте ще раз.",
    retry: "Повторити",
    searchTitle: "Нічого не знайдено",
    searchDescription: "Змініть пошук або покажіть усі прайс-листи.",
    reset: "Скинути",
    catalogTitle: "Прайс-листів ще немає",
    catalogDescription:
      "Створіть окремі ціни для опту, партнерів або сезонних акцій.",
    create: "Новий прайс-лист",
  },
  options: {
    setDefault: "Зробити основним",
    clearDefault: "Прибрати позначку «основний»",
    activate: "Активувати",
    deactivate: "Деактивувати",
    delete: "Видалити",
    close: "Закрити",
  },
  confirm: {
    deleteTitle: "Видалити прайс-лист?",
    deleteDescription:
      "«{{name}}» і всі ціни в ньому буде видалено. Призначені клієнти й групи перейдуть на наступний рівень цін.",
    deleteConfirm: "Видалити",
    cancel: "Скасувати",
  },
  toast: {
    cannotDeactivateDefault: "Спочатку призначте інший основний прайс-лист",
  },
  mutation: {
    error: "Не вдалося оновити прайс-лист. Спробуйте ще раз.",
    offline: "Немає зʼєднання. Спробуйте, коли зʼявиться мережа.",
    permission: "Немає права змінювати прайс-листи.",
  },
  stub: {
    createTitle: "Новий прайс-лист",
    editTitle: "Редагувати прайс-лист",
    placeholderTitle: "Редактор незабаром",
    placeholderDescription:
      "Створення листів і заповнення цін зʼявиться в наступному кроці.",
    notFoundTitle: "Прайс-лист не знайдено",
    notFoundDescription:
      "Не вдалося знайти цей прайс-лист або він недоступний.",
  },
};

export function pricingCopy(locale: Locale): PricingCopy {
  return locale === "uk" ? uk : en;
}
