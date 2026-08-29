/** Documents list + create + public-token copy (uk/en). Locale plumbing lives in `./locale`. */
import type { Locale } from "./locale";

export type DocumentsFormCopy = {
  readonly typeSectionTitle: string;
  readonly orderSectionTitle: string;
  readonly counterpartySectionTitle: string;
  readonly typePaymentInvoice: string;
  readonly typeDeliveryNote: string;
  readonly orderLabel: string;
  readonly orderPlaceholder: string;
  readonly orderSheetTitle: string;
  readonly orderSearchPlaceholder: string;
  readonly orderSearchLabel: string;
  readonly orderEmpty: string;
  readonly counterpartyLabel: string;
  readonly counterpartyPlaceholder: string;
  readonly counterpartyDisabledPlaceholder: string;
  readonly counterpartySheetTitle: string;
  readonly counterpartySearchPlaceholder: string;
  readonly counterpartySearchLabel: string;
  readonly counterpartyEmptyOption: string;
  readonly counterpartyEmpty: string;
  readonly closeSheet: string;
  readonly cancel: string;
  readonly submitCreate: string;
  readonly submitCreateLoading: string;
  readonly leaveTitle: string;
  readonly leaveDescription: string;
  readonly leaveContinue: string;
  readonly leaveConfirm: string;
  readonly permissionCreateTitle: string;
  readonly permissionCreateDescription: string;
  readonly loadingLabel: string;
  readonly errors: {
    readonly orderRequired: string;
    readonly validation: string;
    readonly network: string;
    readonly offline: string;
    readonly unavailable: string;
    readonly permission: string;
    readonly conflict: string;
  };
};

export type DocumentsSharedCopy = {
  readonly title: string;
  readonly loadingLabel: string;
  readonly download: string;
  readonly refresh: string;
  readonly notFoundTitle: string;
  readonly notFoundDescription: string;
  readonly offlineTitle: string;
  readonly offlineDescription: string;
  readonly errorTitle: string;
  readonly errorDescription: string;
  readonly retry: string;
  readonly backLabel: string;
};

export type DocumentsMutationCopy = {
  readonly error: string;
  readonly offline: string;
  readonly permission: string;
};

export type DocumentsEmptyCopy = {
  readonly offlineTitle: string;
  readonly offlineDescription: string;
  readonly errorTitle: string;
  readonly errorDescription: string;
  readonly retry: string;
  readonly filteredTitle: string;
  readonly filteredDescription: string;
  readonly filteredOrderDescription: string;
  readonly filteredTypeAndOrderDescription: string;
  readonly reset: string;
  readonly catalogTitle: string;
  readonly catalogDescription: string;
  readonly create: string;
};

export type DocumentsCopy = {
  readonly title: string;
  readonly createLabel: string;
  readonly backLabel: string;
  readonly optionsLabel: string;
  readonly optionsButton: string;
  readonly loadingLabel: string;
  readonly loadingMoreLabel: string;
  readonly cancelledBadge: string;
  readonly filters: {
    readonly all: string;
    readonly payment_invoice: string;
    readonly delivery_note: string;
  };
  readonly types: {
    readonly payment_invoice: string;
    readonly delivery_note: string;
  };
  readonly empty: DocumentsEmptyCopy;
  readonly options: {
    readonly share: string;
    readonly qr: string;
    readonly print: string;
    readonly openPdf: string;
    readonly cancel: string;
    readonly close: string;
  };
  readonly optionsGet: {
    readonly loading: string;
    readonly offline: string;
    readonly error: string;
  };
  readonly generation: {
    readonly pending: string;
    readonly ready: string;
    readonly failed: string;
  };
  readonly confirm: {
    readonly cancelTitle: string;
    readonly cancelDescription: string;
    readonly cancelConfirm: string;
    readonly dismiss: string;
  };
  readonly handover: {
    readonly title: string;
    readonly copy: string;
    readonly copied: string;
    readonly copyFailed: string;
    readonly share: string;
    readonly hint: string;
    readonly close: string;
  };
  readonly toast: {
    readonly pdfNotReady: string;
    readonly pdfFailed: string;
    readonly pdfOpenFailed: string;
    readonly shareFailed: string;
  };
  readonly mutation: DocumentsMutationCopy;
  readonly form: DocumentsFormCopy;
  readonly shared: DocumentsSharedCopy;
};

const en: DocumentsCopy = {
  title: "Documents",
  createLabel: "New document",
  backLabel: "Back",
  optionsLabel: "Options for {{number}}",
  optionsButton: "Options",
  loadingLabel: "Loading documents",
  loadingMoreLabel: "Loading more documents",
  cancelledBadge: "Cancelled",
  filters: {
    all: "All",
    payment_invoice: "Invoice",
    delivery_note: "Delivery note",
  },
  types: {
    payment_invoice: "Invoice",
    delivery_note: "Delivery note",
  },
  empty: {
    offlineTitle: "No connection",
    offlineDescription: "Check your network and try again.",
    errorTitle: "Could not load documents",
    errorDescription: "Try again in a moment.",
    retry: "Retry",
    filteredTitle: "Nothing found",
    filteredDescription: "Change the type filter.",
    filteredOrderDescription: "No documents for this order.",
    filteredTypeAndOrderDescription:
      "Change the type filter. Documents stay scoped to this order.",
    reset: "Reset",
    catalogTitle: "No documents yet",
    catalogDescription: "Create the first invoice or delivery note.",
    create: "New document",
  },
  options: {
    share: "Share",
    qr: "QR code",
    print: "Print",
    openPdf: "Open PDF",
    cancel: "Cancel document",
    close: "Close",
  },
  optionsGet: {
    loading: "Loading PDF status",
    offline: "No connection. Open PDF to retry.",
    error: "Could not load PDF status. Open PDF to retry.",
  },
  generation: {
    pending: "PDF pending",
    ready: "PDF ready",
    failed: "PDF failed",
  },
  confirm: {
    cancelTitle: "Cancel this document?",
    cancelDescription:
      "The document will move to Cancelled. The number stays consumed.",
    cancelConfirm: "Cancel document",
    dismiss: "Keep",
  },
  handover: {
    title: "Document link",
    copy: "Copy link",
    copied: "Copied",
    copyFailed: "Could not copy the link.",
    share: "Share",
    hint: "Send this link. The counterparty does not need a Showzy account.",
    close: "Close",
  },
  toast: {
    pdfNotReady: "The PDF is not ready yet. Try again in a moment.",
    pdfFailed: "The PDF could not be generated.",
    pdfOpenFailed: "Could not open the PDF.",
    shareFailed: "Could not create a share link.",
  },
  mutation: {
    error: "Could not update the document. Try again.",
    offline: "No connection. Try again when you are online.",
    permission: "You do not have permission to change documents.",
  },
  form: {
    typeSectionTitle: "Document type",
    orderSectionTitle: "Order",
    counterpartySectionTitle: "Counterparty",
    typePaymentInvoice: "Invoice РХ",
    typeDeliveryNote: "Delivery note ВН",
    orderLabel: "Order",
    orderPlaceholder: "Choose an order",
    orderSheetTitle: "Order",
    orderSearchPlaceholder: "Search orders…",
    orderSearchLabel: "Search orders",
    orderEmpty: "No orders found.",
    counterpartyLabel: "Counterparty",
    counterpartyPlaceholder: "Optional — legal face",
    counterpartyDisabledPlaceholder: "Choose an order first",
    counterpartySheetTitle: "Counterparty",
    counterpartySearchPlaceholder: "Search counterparties…",
    counterpartySearchLabel: "Search counterparties",
    counterpartyEmptyOption: "Customer name only",
    counterpartyEmpty: "No counterparties for this customer.",
    closeSheet: "Close",
    cancel: "Cancel",
    submitCreate: "Create document",
    submitCreateLoading: "Creating…",
    leaveTitle: "Leave without saving?",
    leaveDescription: "Your changes will be lost.",
    leaveContinue: "Keep editing",
    leaveConfirm: "Leave without saving",
    permissionCreateTitle: "No permission",
    permissionCreateDescription:
      "You do not have permission to create documents.",
    loadingLabel: "Loading",
    errors: {
      orderRequired: "Choose an order.",
      validation: "Check the highlighted fields.",
      network: "Could not create the document. Try again.",
      offline: "No connection. Try again when you are online.",
      unavailable: "Could not create the document. Try again.",
      permission: "You do not have permission to create documents.",
      conflict:
        "A live document of this type already exists for the order, or the order is canceled.",
    },
  },
  shared: {
    title: "Document",
    loadingLabel: "Loading document",
    download: "Download PDF",
    refresh:
      "The file is not ready or the download expired. Ask the sender to refresh the link.",
    notFoundTitle: "Link is not valid",
    notFoundDescription: "This link is invalid or has expired.",
    offlineTitle: "No connection",
    offlineDescription: "Check your network and try again.",
    errorTitle: "Could not open the document",
    errorDescription: "Try again in a moment.",
    retry: "Retry",
    backLabel: "Back",
  },
};

const uk: DocumentsCopy = {
  title: "Документи",
  createLabel: "Новий документ",
  backLabel: "Назад",
  optionsLabel: "Опції для {{number}}",
  optionsButton: "Опції",
  loadingLabel: "Завантаження документів",
  loadingMoreLabel: "Завантаження наступної сторінки",
  cancelledBadge: "Скасовано",
  filters: {
    all: "Усі",
    payment_invoice: "Рахунок",
    delivery_note: "Видаткова",
  },
  types: {
    payment_invoice: "Рахунок",
    delivery_note: "Видаткова",
  },
  empty: {
    offlineTitle: "Немає з’єднання",
    offlineDescription: "Перевірте мережу і спробуйте ще раз.",
    errorTitle: "Не вдалося завантажити документи",
    errorDescription: "Спробуйте ще раз за мить.",
    retry: "Повторити",
    filteredTitle: "Нічого не знайдено",
    filteredDescription: "Змініть фільтр типу.",
    filteredOrderDescription: "Для цього замовлення документів немає.",
    filteredTypeAndOrderDescription:
      "Змініть фільтр типу. Список залишиться в межах цього замовлення.",
    reset: "Скинути",
    catalogTitle: "Документів ще немає",
    catalogDescription: "Створіть перший рахунок або видаткову накладну.",
    create: "Новий документ",
  },
  options: {
    share: "Поділитися",
    qr: "QR-код",
    print: "Друк",
    openPdf: "Відкрити PDF",
    cancel: "Скасувати документ",
    close: "Закрити",
  },
  optionsGet: {
    loading: "Завантаження статусу PDF",
    offline: "Немає з’єднання. Відкрийте PDF, щоб повторити.",
    error: "Не вдалося завантажити статус PDF. Відкрийте PDF, щоб повторити.",
  },
  generation: {
    pending: "PDF готується",
    ready: "PDF готовий",
    failed: "PDF не вдалося створити",
  },
  confirm: {
    cancelTitle: "Скасувати документ?",
    cancelDescription:
      "Документ змінить статус на «Скасовано». Номер залишиться використаним.",
    cancelConfirm: "Скасувати документ",
    dismiss: "Залишити",
  },
  handover: {
    title: "Посилання на документ",
    copy: "Копіювати посилання",
    copied: "Скопійовано",
    copyFailed: "Не вдалося скопіювати посилання.",
    share: "Поділитися",
    hint: "Надішліть це посилання. Контрагенту не потрібен акаунт Showzy.",
    close: "Закрити",
  },
  toast: {
    pdfNotReady: "PDF ще не готовий. Спробуйте пізніше.",
    pdfFailed: "Не вдалося згенерувати PDF.",
    pdfOpenFailed: "Не вдалося відкрити PDF.",
    shareFailed: "Не вдалося створити посилання.",
  },
  mutation: {
    error: "Не вдалося оновити документ. Спробуйте ще раз.",
    offline: "Немає з’єднання. Спробуйте, коли з’явиться мережа.",
    permission: "У вас немає дозволу змінювати документи.",
  },
  form: {
    typeSectionTitle: "Тип документа",
    orderSectionTitle: "Замовлення",
    counterpartySectionTitle: "Контрагент",
    typePaymentInvoice: "Рахунок РХ",
    typeDeliveryNote: "Видаткова ВН",
    orderLabel: "Замовлення",
    orderPlaceholder: "Обрати замовлення",
    orderSheetTitle: "Замовлення",
    orderSearchPlaceholder: "Пошук замовлень…",
    orderSearchLabel: "Пошук замовлень",
    orderEmpty: "Замовлень не знайдено.",
    counterpartyLabel: "Контрагент",
    counterpartyPlaceholder: "Необов’язково — юрособа",
    counterpartyDisabledPlaceholder: "Спочатку оберіть замовлення",
    counterpartySheetTitle: "Контрагент",
    counterpartySearchPlaceholder: "Пошук контрагентів…",
    counterpartySearchLabel: "Пошук контрагентів",
    counterpartyEmptyOption: "Лише ім’я клієнта",
    counterpartyEmpty: "Для цього клієнта немає контрагентів.",
    closeSheet: "Закрити",
    cancel: "Скасувати",
    submitCreate: "Створити документ",
    submitCreateLoading: "Створення…",
    leaveTitle: "Вийти без збереження?",
    leaveDescription: "Внесені зміни буде втрачено.",
    leaveContinue: "Продовжити редагування",
    leaveConfirm: "Вийти без збереження",
    permissionCreateTitle: "Немає права",
    permissionCreateDescription: "Немає права створювати документи.",
    loadingLabel: "Завантаження",
    errors: {
      orderRequired: "Оберіть замовлення.",
      validation: "Перевірте позначені поля.",
      network: "Не вдалося створити документ. Спробуйте ще раз.",
      offline: "Немає з’єднання. Спробуйте, коли з’явиться мережа.",
      unavailable: "Не вдалося створити документ. Спробуйте ще раз.",
      permission: "Немає права створювати документи.",
      conflict:
        "Живий документ цього типу для замовлення вже є, або замовлення скасовано.",
    },
  },
  shared: {
    title: "Документ",
    loadingLabel: "Завантаження документа",
    download: "Завантажити PDF",
    refresh:
      "Файл ще не готовий або строк завантаження минув. Попросіть відправника оновити посилання.",
    notFoundTitle: "Посилання недійсне",
    notFoundDescription: "Посилання недійсне або строк його дії минув.",
    offlineTitle: "Немає з’єднання",
    offlineDescription: "Перевірте мережу і спробуйте ще раз.",
    errorTitle: "Не вдалося відкрити документ",
    errorDescription: "Спробуйте ще раз за мить.",
    retry: "Повторити",
    backLabel: "Назад",
  },
};

export function documentsCopy(locale: Locale): DocumentsCopy {
  return locale === "uk" ? uk : en;
}
