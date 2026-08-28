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
  readonly deleteCounterpartyTitle: string;
  readonly deleteCounterpartyDescription: string;
  readonly deleteCounterpartyConfirm: string;
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
  readonly counterpartiesTitle: string;
  readonly counterpartiesDescription: string;
  readonly counterpartiesSearchTitle: string;
  readonly counterpartiesSearchDescription: string;
  readonly counterpartiesCreate: string;
};

export type CustomersComingSoonCopy = {
  readonly invitationsTitle: string;
  readonly invitationsDescription: string;
};

export type CustomersEditorStubCopy = {
  readonly clientCreateTitle: string;
  readonly clientEditTitle: string;
  readonly groupCreateTitle: string;
  readonly groupEditTitle: string;
  readonly counterpartyCreateTitle: string;
  readonly counterpartyEditTitle: string;
  readonly counterpartyPlaceholderTitle: string;
  readonly counterpartyPlaceholderDescription: string;
};

export type CustomersFormCopy = {
  readonly contactsTitle: string;
  readonly contactsHelper: string;
  readonly nameLabel: string;
  readonly namePlaceholder: string;
  readonly phoneLabel: string;
  readonly phonePlaceholder: string;
  readonly emailLabel: string;
  readonly emailPlaceholder: string;
  readonly termsTitle: string;
  readonly groupLabel: string;
  readonly groupPlaceholder: string;
  readonly groupSheetTitle: string;
  readonly groupEmptyOption: string;
  readonly groupSearchPlaceholder: string;
  readonly assignmentUnavailable: string;
  readonly priceListLabel: string;
  readonly priceListInheritGroup: string;
  readonly priceListDefault: string;
  readonly priceListSheetTitle: string;
  readonly priceListEmptyOption: string;
  readonly priceListSearchPlaceholder: string;
  readonly counterpartiesTitle: string;
  readonly counterpartiesHelper: string;
  readonly counterpartiesCreateHint: string;
  readonly counterpartiesEmpty: string;
  readonly notesTitle: string;
  readonly notesLabel: string;
  readonly notesPlaceholder: string;
  readonly archiveTitle: string;
  readonly archiveActiveHelper: string;
  readonly archiveArchivedHelper: string;
  readonly archiveAction: string;
  readonly restoreAction: string;
  readonly deleteAction: string;
  readonly cancel: string;
  readonly changedLabel: string;
  readonly closeSheet: string;
  readonly leaveTitle: string;
  readonly leaveDescription: string;
  readonly leaveContinue: string;
  readonly leaveConfirm: string;
  readonly submitCreate: string;
  readonly submitCreateLoading: string;
  readonly submitEdit: string;
  readonly submitEditLoading: string;
  readonly permissionCreateTitle: string;
  readonly permissionCreateDescription: string;
  readonly permissionEditTitle: string;
  readonly permissionEditDescription: string;
  readonly notFoundTitle: string;
  readonly notFoundDescription: string;
  readonly loadingLabel: string;
  readonly errors: {
    readonly nameRequired: string;
    readonly nameTooLong: string;
    readonly phoneTooLong: string;
    readonly emailTooLong: string;
    readonly notesTooLong: string;
    readonly contactRequired: string;
    readonly validation: string;
    readonly network: string;
    readonly offline: string;
    readonly unavailable: string;
    readonly permission: string;
  };
};

export type CustomersGroupFormCopy = {
  readonly aboutTitle: string;
  readonly nameLabel: string;
  readonly namePlaceholder: string;
  readonly descriptionLabel: string;
  readonly descriptionPlaceholder: string;
  readonly memberHint: string;
  readonly termsTitle: string;
  readonly priceListLabel: string;
  readonly priceListPlaceholder: string;
  readonly priceListSheetTitle: string;
  readonly priceListEmptyOption: string;
  readonly priceListSearchPlaceholder: string;
  readonly assignmentUnavailable: string;
  readonly cancel: string;
  readonly changedLabel: string;
  readonly closeSheet: string;
  readonly leaveTitle: string;
  readonly leaveDescription: string;
  readonly leaveContinue: string;
  readonly leaveConfirm: string;
  readonly submitCreate: string;
  readonly submitCreateLoading: string;
  readonly submitEdit: string;
  readonly submitEditLoading: string;
  readonly permissionCreateTitle: string;
  readonly permissionCreateDescription: string;
  readonly permissionEditTitle: string;
  readonly permissionEditDescription: string;
  readonly notFoundTitle: string;
  readonly notFoundDescription: string;
  readonly loadingLabel: string;
  readonly errors: {
    readonly nameRequired: string;
    readonly nameTooLong: string;
    readonly descriptionTooLong: string;
    readonly validation: string;
    readonly network: string;
    readonly offline: string;
    readonly unavailable: string;
    readonly permission: string;
  };
};

export type CustomersCopy = {
  readonly title: string;
  readonly searchLabel: string;
  readonly clientsSearchPlaceholder: string;
  readonly groupsSearchPlaceholder: string;
  readonly counterpartiesSearchPlaceholder: string;
  readonly createClientLabel: string;
  readonly createGroupLabel: string;
  readonly createCounterpartyLabel: string;
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
  readonly edrpouBadge: string;
  readonly counterparties: CustomersCountForms;
  readonly members: CustomersCountForms;
  readonly empty: CustomersEmptyCopy;
  readonly comingSoon: CustomersComingSoonCopy;
  readonly confirm: CustomersConfirmCopy;
  readonly mutation: CustomersMutationCopy;
  readonly editorStub: CustomersEditorStubCopy;
  readonly form: CustomersFormCopy;
  readonly groupForm: CustomersGroupFormCopy;
};

const en: CustomersCopy = {
  title: "Customers",
  searchLabel: "Search",
  clientsSearchPlaceholder: "Name, phone, or email",
  groupsSearchPlaceholder: "Group name",
  counterpartiesSearchPlaceholder: "Name or EDRPOU",
  createClientLabel: "New client",
  createGroupLabel: "New group",
  createCounterpartyLabel: "New counterparty",
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
  edrpouBadge: "EDRPOU {{edrpou}}",
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
    counterpartiesTitle: "No counterparties yet",
    counterpartiesDescription:
      "A legal face for invoices and QES. It can stand alone — for example a supplier — without a CRM client.",
    counterpartiesSearchTitle: "No counterparties found",
    counterpartiesSearchDescription: "Try a different query.",
    counterpartiesCreate: "New counterparty",
  },
  comingSoon: {
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
    deleteCounterpartyTitle: "Delete this counterparty?",
    deleteCounterpartyDescription:
      "The counterparty will be deleted forever. A linked client stays. This cannot be undone.",
    deleteCounterpartyConfirm: "Delete counterparty",
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
    counterpartyCreateTitle: "New counterparty",
    counterpartyEditTitle: "Edit counterparty",
    counterpartyPlaceholderTitle: "Editor coming next",
    counterpartyPlaceholderDescription:
      "The counterparty form arrives in a later update.",
  },
  form: {
    contactsTitle: "Contacts",
    contactsHelper:
      "At least one contact is required: phone, email, or a linked Showzy account.",
    nameLabel: "Name",
    namePlaceholder: "For example, Maria Tkachenko",
    phoneLabel: "Phone",
    phonePlaceholder: "+380 67 000 00 00",
    emailLabel: "Email",
    emailPlaceholder: "client@email.com",
    termsTitle: "Service terms",
    groupLabel: "Client group",
    groupPlaceholder: "No group",
    groupSheetTitle: "Client group",
    groupEmptyOption: "No group",
    groupSearchPlaceholder: "Search groups…",
    assignmentUnavailable: "Assigned",
    priceListLabel: "Price list",
    priceListInheritGroup: "Inherited from the group",
    priceListDefault: "Retail by default",
    priceListSheetTitle: "Price list",
    priceListEmptyOption: "Default",
    priceListSearchPlaceholder: "Search price lists…",
    counterpartiesTitle: "Legal entities",
    counterpartiesHelper:
      "For invoices and QES. One client can have several FOPs. Groups and price lists stay on the client.",
    counterpartiesCreateHint: "Save the client to add an FOP or LLC.",
    counterpartiesEmpty: "No linked counterparties.",
    notesTitle: "Notes",
    notesLabel: "Internal use",
    notesPlaceholder: "Preferences, allergies, delivery details",
    archiveTitle: "Archive",
    archiveActiveHelper: "Archive first, then delete. Orders stay.",
    archiveArchivedHelper:
      "This client is archived. Delete is only available here.",
    archiveAction: "Archive",
    restoreAction: "Restore",
    deleteAction: "Delete forever",
    cancel: "Cancel",
    changedLabel: "Changed",
    closeSheet: "Close",
    leaveTitle: "Leave without saving?",
    leaveDescription: "Your changes will be lost.",
    leaveContinue: "Keep editing",
    leaveConfirm: "Leave without saving",
    submitCreate: "Create",
    submitCreateLoading: "Saving…",
    submitEdit: "Save",
    submitEditLoading: "Saving…",
    permissionCreateTitle: "No permission to create",
    permissionCreateDescription:
      "You can view clients, but creating them needs a higher role.",
    permissionEditTitle: "No permission to edit",
    permissionEditDescription:
      "You can view this client, but editing needs a higher role.",
    notFoundTitle: "Client not found",
    notFoundDescription:
      "The record may have been deleted, or the link is out of date.",
    loadingLabel: "Loading client",
    errors: {
      nameRequired: "Enter the client name",
      nameTooLong: "Name is too long.",
      phoneTooLong: "Phone is too long.",
      emailTooLong: "Email is too long.",
      notesTooLong: "Notes are too long.",
      contactRequired: "Phone, email, or a linked account is required",
      validation: "Check the highlighted fields.",
      network: "Could not save. Try again.",
      offline: "No connection. Connect and try again.",
      unavailable: "Could not save. Try again.",
      permission: "You do not have permission to change this.",
    },
  },
  groupForm: {
    aboutTitle: "About the group",
    nameLabel: "Name",
    namePlaceholder: "For example, Wholesale buyers",
    descriptionLabel: "Description (optional)",
    descriptionPlaceholder: "Who this group is for",
    memberHint:
      "The group has {{members}}. Deleting the group only removes this assignment.",
    termsTitle: "Terms",
    priceListLabel: "Default price list",
    priceListPlaceholder: "Retail",
    priceListSheetTitle: "Price list",
    priceListEmptyOption: "Default",
    priceListSearchPlaceholder: "Search price lists…",
    assignmentUnavailable: "Assigned",
    cancel: "Cancel",
    changedLabel: "Changed",
    closeSheet: "Close",
    leaveTitle: "Leave without saving?",
    leaveDescription: "Your changes will be lost.",
    leaveContinue: "Keep editing",
    leaveConfirm: "Leave without saving",
    submitCreate: "Create",
    submitCreateLoading: "Saving…",
    submitEdit: "Save",
    submitEditLoading: "Saving…",
    permissionCreateTitle: "No permission to create",
    permissionCreateDescription:
      "You can view groups, but creating them needs a higher role.",
    permissionEditTitle: "No permission to edit",
    permissionEditDescription:
      "You can view this group, but editing needs a higher role.",
    notFoundTitle: "Group not found",
    notFoundDescription:
      "The group may have been deleted, or the link is out of date.",
    loadingLabel: "Loading group",
    errors: {
      nameRequired: "Enter the group name",
      nameTooLong: "Name is too long.",
      descriptionTooLong: "Description is too long.",
      validation: "Check the highlighted fields.",
      network: "Could not save. Try again.",
      offline: "No connection. Connect and try again.",
      unavailable: "Could not save. Try again.",
      permission: "You do not have permission to change this.",
    },
  },
};

const uk: CustomersCopy = {
  title: "Клієнти",
  searchLabel: "Пошук",
  clientsSearchPlaceholder: "Ім’я, телефон або email",
  groupsSearchPlaceholder: "Назва групи",
  counterpartiesSearchPlaceholder: "Назва або ЄДРПОУ",
  createClientLabel: "Новий клієнт",
  createGroupLabel: "Нова група",
  createCounterpartyLabel: "Новий контрагент",
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
  edrpouBadge: "ЄДРПОУ {{edrpou}}",
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
    counterpartiesTitle: "Контрагентів ще немає",
    counterpartiesDescription:
      "Юрособа для рахунків і КЕП. Може бути без клієнта — наприклад, постачальник.",
    counterpartiesSearchTitle: "Контрагентів не знайдено",
    counterpartiesSearchDescription: "Спробуйте інший запит.",
    counterpartiesCreate: "Новий контрагент",
  },
  comingSoon: {
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
    deleteCounterpartyTitle: "Видалити контрагента?",
    deleteCounterpartyDescription:
      "Контрагента буде видалено назавжди. Клієнт (якщо був прив’язаний) залишиться. Цю дію не можна скасувати.",
    deleteCounterpartyConfirm: "Видалити контрагента",
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
    counterpartyCreateTitle: "Новий контрагент",
    counterpartyEditTitle: "Редагувати контрагента",
    counterpartyPlaceholderTitle: "Редактор незабаром",
    counterpartyPlaceholderDescription:
      "Форма контрагента з’явиться в окремому оновленні.",
  },
  form: {
    contactsTitle: "Контакти",
    contactsHelper:
      "Потрібен хоча б один контакт: телефон, email або прив’язаний акаунт Showzy.",
    nameLabel: "Ім’я",
    namePlaceholder: "Наприклад, Марія Ткаченко",
    phoneLabel: "Телефон",
    phonePlaceholder: "+380 67 000 00 00",
    emailLabel: "Email",
    emailPlaceholder: "client@email.com",
    termsTitle: "Умови обслуговування",
    groupLabel: "Група клієнтів",
    groupPlaceholder: "Без групи",
    groupSheetTitle: "Група клієнтів",
    groupEmptyOption: "Без групи",
    groupSearchPlaceholder: "Пошук груп…",
    assignmentUnavailable: "Призначено",
    priceListLabel: "Прайс-лист",
    priceListInheritGroup: "Успадкований від групи",
    priceListDefault: "Роздрібний за замовчуванням",
    priceListSheetTitle: "Прайс-лист",
    priceListEmptyOption: "За замовчуванням",
    priceListSearchPlaceholder: "Пошук прайс-листів…",
    counterpartiesTitle: "Юрособи",
    counterpartiesHelper:
      "Для рахунків і КЕП. Один клієнт може мати кілька ФОП. Групи та прайси лишаються на клієнті.",
    counterpartiesCreateHint: "Збережіть клієнта, щоб додати ФОП або ТОВ.",
    counterpartiesEmpty: "Немає прив’язаних контрагентів.",
    notesTitle: "Нотатки",
    notesLabel: "Для внутрішнього використання",
    notesPlaceholder: "Побажання, алергії, деталі доставки",
    archiveTitle: "Архів",
    archiveActiveHelper:
      "Спочатку архів, потім видалення. Замовлення залишаться.",
    archiveArchivedHelper: "Клієнт в архіві. Видалити можна лише звідси.",
    archiveAction: "Архівувати",
    restoreAction: "Відновити",
    deleteAction: "Видалити назавжди",
    cancel: "Скасувати",
    changedLabel: "змінено",
    closeSheet: "Закрити",
    leaveTitle: "Вийти без збереження?",
    leaveDescription: "Внесені зміни буде втрачено.",
    leaveContinue: "Продовжити редагування",
    leaveConfirm: "Вийти без збереження",
    submitCreate: "Створити",
    submitCreateLoading: "Збереження…",
    submitEdit: "Зберегти",
    submitEditLoading: "Збереження…",
    permissionCreateTitle: "Немає права створювати",
    permissionCreateDescription:
      "Ви можете переглядати клієнтів, але створення потребує вищої ролі.",
    permissionEditTitle: "Немає права редагувати",
    permissionEditDescription:
      "Ви можете переглядати цього клієнта, але редагування потребує вищої ролі.",
    notFoundTitle: "Клієнта не знайдено",
    notFoundDescription:
      "Можливо, запис було видалено або посилання застаріло.",
    loadingLabel: "Завантаження клієнта",
    errors: {
      nameRequired: "Вкажіть ім’я клієнта",
      nameTooLong: "Ім’я задовге.",
      phoneTooLong: "Телефон задовгий.",
      emailTooLong: "Email задовгий.",
      notesTooLong: "Нотатки задовгі.",
      contactRequired: "Потрібен телефон, email або прив’язаний акаунт",
      validation: "Перевірте виділені поля.",
      network: "Не вдалося зберегти. Спробуйте ще раз.",
      offline: "Немає зʼєднання. Підключіться і спробуйте ще раз.",
      unavailable: "Не вдалося зберегти. Спробуйте ще раз.",
      permission: "Немає права змінювати цей запис.",
    },
  },
  groupForm: {
    aboutTitle: "Про групу",
    nameLabel: "Назва",
    namePlaceholder: "Наприклад, Оптові покупці",
    descriptionLabel: "Опис (необовʼязково)",
    descriptionPlaceholder: "Кому підходить ця група",
    memberHint:
      "У групі {{members}}. Видалення групи лише прибере це призначення.",
    termsTitle: "Умови",
    priceListLabel: "Прайс-лист за замовчуванням",
    priceListPlaceholder: "Роздрібний",
    priceListSheetTitle: "Прайс-лист",
    priceListEmptyOption: "За замовчуванням",
    priceListSearchPlaceholder: "Пошук прайс-листів…",
    assignmentUnavailable: "Призначено",
    cancel: "Скасувати",
    changedLabel: "змінено",
    closeSheet: "Закрити",
    leaveTitle: "Вийти без збереження?",
    leaveDescription: "Внесені зміни буде втрачено.",
    leaveContinue: "Продовжити редагування",
    leaveConfirm: "Вийти без збереження",
    submitCreate: "Створити",
    submitCreateLoading: "Збереження…",
    submitEdit: "Зберегти",
    submitEditLoading: "Збереження…",
    permissionCreateTitle: "Немає права створювати",
    permissionCreateDescription:
      "Ви можете переглядати групи, але створення потребує вищої ролі.",
    permissionEditTitle: "Немає права редагувати",
    permissionEditDescription:
      "Ви можете переглядати цю групу, але редагування потребує вищої ролі.",
    notFoundTitle: "Групу не знайдено",
    notFoundDescription: "Можливо, її було видалено або посилання застаріло.",
    loadingLabel: "Завантаження групи",
    errors: {
      nameRequired: "Вкажіть назву групи",
      nameTooLong: "Назва задовга.",
      descriptionTooLong: "Опис задовгий.",
      validation: "Перевірте виділені поля.",
      network: "Не вдалося зберегти. Спробуйте ще раз.",
      offline: "Немає зʼєднання. Підключіться і спробуйте ще раз.",
      unavailable: "Не вдалося зберегти. Спробуйте ще раз.",
      permission: "Немає права змінювати цей запис.",
    },
  },
};

export function customersCopy(locale: Locale): CustomersCopy {
  return locale === "uk" ? uk : en;
}
