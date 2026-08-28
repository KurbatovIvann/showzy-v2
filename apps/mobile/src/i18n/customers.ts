/** Customers list copy namespace (uk/en). Locale plumbing lives in `./locale`. */
import type { Locale } from "./locale";

export type CustomersCountForms = {
  readonly one: string;
  readonly few: string;
  readonly many: string;
};

export type CustomersMutationCopy = {
  readonly error: string;
  readonly offline: string;
  readonly permission: string;
};

export type CustomersConfirmCopy = {
  readonly archiveTitle: string;
  readonly archiveDescription: string;
  readonly archiveConfirm: string;
  readonly deleteTitle: string;
  readonly deleteDescription: string;
  readonly deleteConfirm: string;
  readonly deleteGroupTitle: string;
  readonly deleteGroupDescription: CustomersCountForms;
  readonly deleteGroupDescriptionEmpty: string;
  readonly deleteGroupConfirm: string;
  readonly cancel: string;
};

export type CustomersEmptyCopy = {
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
  readonly showArchived: string;
  readonly groupsTitle: string;
  readonly groupsDescription: string;
  readonly groupsSearchTitle: string;
  readonly groupsSearchDescription: string;
  readonly groupsCreate: string;
};

export type CustomersComingSoonCopy = {
  readonly counterpartiesTitle: string;
  readonly counterpartiesDescription: string;
  readonly invitationsTitle: string;
  readonly invitationsDescription: string;
};

export type CustomersEditorStubCopy = {
  readonly clientCreateTitle: string;
  readonly clientEditTitle: string;
  readonly groupCreateTitle: string;
  readonly groupEditTitle: string;
  readonly title: string;
  readonly description: string;
};

export type CustomersCopy = {
  readonly title: string;
  readonly searchLabel: string;
  readonly clientsSearchPlaceholder: string;
  readonly groupsSearchPlaceholder: string;
  readonly createClientLabel: string;
  readonly createGroupLabel: string;
  readonly backLabel: string;
  readonly tabs: {
    readonly clients: string;
    readonly groups: string;
    readonly counterparties: string;
    readonly invitations: string;
  };
  readonly filters: {
    readonly all: string;
    readonly archived: string;
  };
  readonly archivedBadge: string;
  readonly editLabel: string;
  readonly archiveLabel: string;
  readonly deleteLabel: string;
  readonly restoreLabel: string;
  readonly loadingLabel: string;
  readonly loadingMoreLabel: string;
  readonly counterparties: CustomersCountForms;
  readonly members: CustomersCountForms;
  readonly empty: CustomersEmptyCopy;
  readonly comingSoon: CustomersComingSoonCopy;
  readonly confirm: CustomersConfirmCopy;
  readonly mutation: CustomersMutationCopy;
  readonly editorStub: CustomersEditorStubCopy;
};

const en: CustomersCopy = {
  title: "Customers",
  searchLabel: "Search",
  clientsSearchPlaceholder: "Name, phone, or email",
  groupsSearchPlaceholder: "Group name",
  createClientLabel: "New client",
  createGroupLabel: "New group",
  backLabel: "Back",
  tabs: {
    clients: "Clients",
    groups: "Groups",
    counterparties: "Counterparties",
    invitations: "Invitations",
  },
  filters: {
    all: "All",
    archived: "Archive",
  },
  archivedBadge: "Archived",
  editLabel: "Edit",
  archiveLabel: "Archive {{name}}",
  deleteLabel: "Delete {{name}}",
  restoreLabel: "Restore",
  loadingLabel: "Loading customers",
  loadingMoreLabel: "Loading more",
  counterparties: {
    one: "{{count}} counterparty",
    few: "{{count}} counterparties",
    many: "{{count}} counterparties",
  },
  members: {
    one: "{{count}} client",
    few: "{{count}} clients",
    many: "{{count}} clients",
  },
  empty: {
    offlineTitle: "No connection",
    offlineDescription:
      "The customer list is unavailable offline. Connect and try again.",
    errorTitle: "Could not load customers",
    errorDescription: "Check your connection and try again.",
    retry: "Retry",
    searchTitle: "Nothing found",
    searchDescription: "Change the query or reset the filters.",
    reset: "Reset",
    archivedTitle: "The archive is empty",
    archivedDescription: "Archive first, then delete. Delete is archive-only.",
    catalogTitle: "No clients yet",
    catalogDescription: "Add the first client to speed up order checkout.",
    create: "New client",
    activeTitle: "No active clients",
    activeDescription: "Restore a client from the archive or view the archive.",
    showArchived: "Show archive",
    groupsTitle: "No groups yet",
    groupsDescription:
      "Groups segment clients only. A group's price list is inherited when the client has none.",
    groupsSearchTitle: "No groups found",
    groupsSearchDescription: "Try a different query.",
    groupsCreate: "New group",
  },
  comingSoon: {
    counterpartiesTitle: "Coming soon",
    counterpartiesDescription:
      "Counterparty records will arrive in a later update.",
    invitationsTitle: "Coming soon",
    invitationsDescription: "Invitations will arrive in a later update.",
  },
  confirm: {
    archiveTitle: "Archive this client?",
    archiveDescription:
      "Archive first, then delete. The client leaves the active list. Orders stay. Delete is only available from the archive.",
    archiveConfirm: "Archive",
    deleteTitle: "Delete this client?",
    deleteDescription:
      "The client will be deleted forever. Counterparties stay unlinked. This cannot be undone.",
    deleteConfirm: "Delete",
    deleteGroupTitle: "Delete this group?",
    deleteGroupDescription: {
      one: "{{count}} client will stay with no group. Their price lists do not change.",
      few: "{{count}} clients will stay with no group. Their price lists do not change.",
      many: "{{count}} clients will stay with no group. Their price lists do not change.",
    },
    deleteGroupDescriptionEmpty:
      "The group will be deleted. Clients are not removed.",
    deleteGroupConfirm: "Delete group",
    cancel: "Cancel",
  },
  mutation: {
    error: "Could not update. Try again.",
    offline: "No connection. Connect and try again.",
    permission: "You do not have permission to change this.",
  },
  editorStub: {
    clientCreateTitle: "New client",
    clientEditTitle: "Edit client",
    groupCreateTitle: "New group",
    groupEditTitle: "Edit group",
    title: "Coming soon",
    description: "Create and edit forms land in the next tickets.",
  },
};

const uk: CustomersCopy = {
  title: "Клієнти",
  searchLabel: "Пошук",
  clientsSearchPlaceholder: "Ім’я, телефон або email",
  groupsSearchPlaceholder: "Назва групи",
  createClientLabel: "Новий клієнт",
  createGroupLabel: "Нова група",
  backLabel: "Назад",
  tabs: {
    clients: "Клієнти",
    groups: "Групи",
    counterparties: "Контрагенти",
    invitations: "Запрошення",
  },
  filters: {
    all: "Усі",
    archived: "Архів",
  },
  archivedBadge: "В архіві",
  editLabel: "Редагувати",
  archiveLabel: "Архівувати {{name}}",
  deleteLabel: "Видалити {{name}}",
  restoreLabel: "Відновити",
  loadingLabel: "Завантаження клієнтів",
  loadingMoreLabel: "Завантаження наступних",
  counterparties: {
    one: "{{count}} контрагент",
    few: "{{count}} контрагенти",
    many: "{{count}} контрагентів",
  },
  members: {
    one: "{{count}} клієнт",
    few: "{{count}} клієнти",
    many: "{{count}} клієнтів",
  },
  empty: {
    offlineTitle: "Немає зʼєднання",
    offlineDescription:
      "Список клієнтів недоступний офлайн. Підключіться і спробуйте ще раз.",
    errorTitle: "Не вдалося завантажити клієнтів",
    errorDescription: "Перевірте з’єднання та спробуйте ще раз.",
    retry: "Повторити",
    searchTitle: "Нічого не знайдено",
    searchDescription: "Змініть запит або скиньте фільтри.",
    reset: "Скинути",
    archivedTitle: "Архів порожній",
    archivedDescription:
      "Спочатку архів, потім видалення. Видалити можна лише з архіву.",
    catalogTitle: "Клієнтів ще немає",
    catalogDescription:
      "Додайте першого клієнта, щоб швидше оформлювати замовлення.",
    create: "Новий клієнт",
    activeTitle: "Активних клієнтів немає",
    activeDescription: "Поверніть клієнта з архіву або відкрийте архів.",
    showArchived: "Показати архів",
    groupsTitle: "Груп ще немає",
    groupsDescription:
      "Групи сегментують лише клієнтів. Прайс групи успадковується, якщо в клієнта немає власного.",
    groupsSearchTitle: "Групи не знайдено",
    groupsSearchDescription: "Спробуйте інший запит.",
    groupsCreate: "Нова група",
  },
  comingSoon: {
    counterpartiesTitle: "Незабаром",
    counterpartiesDescription: "Контрагенти з’являться в окремому оновленні.",
    invitationsTitle: "Незабаром",
    invitationsDescription: "Запрошення з’являться в окремому оновленні.",
  },
  confirm: {
    archiveTitle: "Архівувати клієнта?",
    archiveDescription:
      "Спочатку архів, потім видалення. Клієнт зникне з активного списку. Замовлення залишаться. Видалити можна буде лише з архіву.",
    archiveConfirm: "Архівувати",
    deleteTitle: "Видалити клієнта?",
    deleteDescription:
      "Клієнта буде видалено назавжди. Контрагенти залишаться без прив’язки. Цю дію не можна скасувати.",
    deleteConfirm: "Видалити",
    deleteGroupTitle: "Видалити групу?",
    deleteGroupDescription: {
      one: "{{count}} клієнт залишиться без групи. Їхні прайс-листи не зміняться.",
      few: "{{count}} клієнти залишаться без групи. Їхні прайс-листи не зміняться.",
      many: "{{count}} клієнтів залишаться без групи. Їхні прайс-листи не зміняться.",
    },
    deleteGroupDescriptionEmpty:
      "Групу буде видалено. Клієнти не постраждають.",
    deleteGroupConfirm: "Видалити групу",
    cancel: "Скасувати",
  },
  mutation: {
    error: "Не вдалося оновити. Спробуйте ще раз.",
    offline: "Немає зʼєднання. Підключіться і спробуйте ще раз.",
    permission: "Немає права змінювати цей запис.",
  },
  editorStub: {
    clientCreateTitle: "Новий клієнт",
    clientEditTitle: "Редагувати клієнта",
    groupCreateTitle: "Нова група",
    groupEditTitle: "Редагувати групу",
    title: "Незабаром",
    description:
      "Форми створення та редагування з’являться в наступних тікетах.",
  },
};

export function customersCopy(locale: Locale): CustomersCopy {
  return locale === "uk" ? uk : en;
}
