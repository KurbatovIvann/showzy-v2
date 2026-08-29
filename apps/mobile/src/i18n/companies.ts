/** Company settings hub + legal editor copy namespace (uk/en). Locale plumbing lives in `./locale`. */
import type { Locale } from "./locale";

export type CompaniesLegalFormCopy = {
  readonly typeLabel: string;
  readonly typeFop: string;
  readonly typeTov: string;
  readonly companyTitle: string;
  readonly legalNameLabel: string;
  readonly legalNamePlaceholder: string;
  readonly edrpouLabel: string;
  readonly edrpouPlaceholder: string;
  readonly legalAddressLabel: string;
  readonly legalAddressPlaceholder: string;
  readonly bankTitle: string;
  readonly ibanLabel: string;
  readonly ibanPlaceholder: string;
  readonly bankNameLabel: string;
  readonly bankNamePlaceholder: string;
  readonly bankMfoLabel: string;
  readonly bankMfoPlaceholder: string;
  readonly bankEdrpouLabel: string;
  readonly bankEdrpouPlaceholder: string;
  readonly contactsTitle: string;
  readonly contactsHelper: string;
  readonly phoneLabel: string;
  readonly phonePlaceholder: string;
  readonly emailLabel: string;
  readonly emailPlaceholder: string;
  readonly cancel: string;
  readonly changedLabel: string;
  readonly leaveTitle: string;
  readonly leaveDescription: string;
  readonly leaveContinue: string;
  readonly leaveConfirm: string;
  readonly submitAdd: string;
  readonly submitAddLoading: string;
  readonly submitEdit: string;
  readonly submitEditLoading: string;
  readonly loadingLabel: string;
  readonly errors: {
    readonly legalNameRequired: string;
    readonly legalNameTooLong: string;
    readonly edrpouTooLong: string;
    readonly legalAddressTooLong: string;
    readonly ibanTooLong: string;
    readonly bankNameTooLong: string;
    readonly bankMfoTooLong: string;
    readonly bankEdrpouTooLong: string;
    readonly phoneTooLong: string;
    readonly emailTooLong: string;
    readonly validation: string;
    readonly conflict: string;
    readonly network: string;
    readonly offline: string;
    readonly unavailable: string;
    readonly permission: string;
  };
};

export type CompaniesCopy = {
  readonly title: string;
  readonly backLabel: string;
  readonly loadingLabel: string;
  readonly offlineTitle: string;
  readonly offlineDescription: string;
  readonly errorTitle: string;
  readonly errorDescription: string;
  readonly retry: string;
  readonly permissionTitle: string;
  readonly permissionDescription: string;
  readonly slugDisplay: string;
  readonly prefixTitle: string;
  readonly prefixExplanation: string;
  readonly documentsSection: string;
  readonly legalLabel: string;
  readonly legalMissing: string;
  readonly legalForm: CompaniesLegalFormCopy;
};

const enLegalForm: CompaniesLegalFormCopy = {
  typeLabel: "Entity type",
  typeFop: "FOP",
  typeTov: "LLC",
  companyTitle: "Company information",
  legalNameLabel: "Legal name",
  legalNamePlaceholder: "FOP Last First Patronymic",
  edrpouLabel: "EDRPOU / TIN",
  edrpouPlaceholder: "1234567890",
  legalAddressLabel: "Legal address",
  legalAddressPlaceholder: "Kyiv, Khreshchatyk St, 1",
  bankTitle: "Bank details",
  ibanLabel: "IBAN",
  ibanPlaceholder: "UA00 0000 0000 0000 0000 0000 000",
  bankNameLabel: "Bank",
  bankNamePlaceholder: "Monobank",
  bankMfoLabel: "MFO",
  bankMfoPlaceholder: "322001",
  bankEdrpouLabel: "Bank EDRPOU (optional)",
  bankEdrpouPlaceholder: "12345678",
  contactsTitle: "Contacts for documents",
  contactsHelper: "May differ from profile contacts",
  phoneLabel: "Phone",
  phonePlaceholder: "+380 44 000 00 00",
  emailLabel: "Email (optional)",
  emailPlaceholder: "documents@company.ua",
  cancel: "Cancel",
  changedLabel: "Changed",
  leaveTitle: "Leave without saving?",
  leaveDescription: "Your changes will be lost.",
  leaveContinue: "Keep editing",
  leaveConfirm: "Leave without saving",
  submitAdd: "Add requisites",
  submitAddLoading: "Saving…",
  submitEdit: "Save",
  submitEditLoading: "Saving…",
  loadingLabel: "Loading legal requisites",
  errors: {
    legalNameRequired: "Enter the legal name",
    legalNameTooLong: "Name is too long.",
    edrpouTooLong: "EDRPOU is too long.",
    legalAddressTooLong: "Legal address is too long.",
    ibanTooLong: "IBAN is too long.",
    bankNameTooLong: "Bank name is too long.",
    bankMfoTooLong: "MFO is too long.",
    bankEdrpouTooLong: "Bank EDRPOU is too long.",
    phoneTooLong: "Phone is too long.",
    emailTooLong: "Email is too long.",
    validation: "Check the highlighted fields.",
    conflict: "Could not save. Try again.",
    network: "Could not save. Try again.",
    offline: "No connection. Connect and try again.",
    unavailable: "Could not save. Try again.",
    permission: "You do not have permission to change this.",
  },
};

const ukLegalForm: CompaniesLegalFormCopy = {
  typeLabel: "Тип суб’єкта",
  typeFop: "ФОП",
  typeTov: "ТОВ",
  companyTitle: "Інформація про компанію",
  legalNameLabel: "Юридична назва",
  legalNamePlaceholder: "ФОП Прізвище Ім’я По батькові",
  edrpouLabel: "ЄДРПОУ / ІПН",
  edrpouPlaceholder: "1234567890",
  legalAddressLabel: "Юридична адреса",
  legalAddressPlaceholder: "м. Київ, вул. Хрещатик, 1",
  bankTitle: "Банківські реквізити",
  ibanLabel: "IBAN",
  ibanPlaceholder: "UA00 0000 0000 0000 0000 0000 000",
  bankNameLabel: "Банк",
  bankNamePlaceholder: "Монобанк",
  bankMfoLabel: "МФО",
  bankMfoPlaceholder: "322001",
  bankEdrpouLabel: "ЄДРПОУ банку (необовʼязково)",
  bankEdrpouPlaceholder: "12345678",
  contactsTitle: "Контакти для документів",
  contactsHelper: "Можуть відрізнятися від контактів профілю",
  phoneLabel: "Телефон",
  phonePlaceholder: "+380 44 000 00 00",
  emailLabel: "Email (необовʼязково)",
  emailPlaceholder: "documents@company.ua",
  cancel: "Скасувати",
  changedLabel: "змінено",
  leaveTitle: "Вийти без збереження?",
  leaveDescription: "Внесені зміни буде втрачено.",
  leaveContinue: "Продовжити редагування",
  leaveConfirm: "Вийти без збереження",
  submitAdd: "Додати реквізити",
  submitAddLoading: "Збереження…",
  submitEdit: "Зберегти",
  submitEditLoading: "Збереження…",
  loadingLabel: "Завантаження реквізитів",
  errors: {
    legalNameRequired: "Вкажіть юридичну назву",
    legalNameTooLong: "Назва задовга.",
    edrpouTooLong: "ЄДРПОУ задовге.",
    legalAddressTooLong: "Юридична адреса задовга.",
    ibanTooLong: "IBAN задовгий.",
    bankNameTooLong: "Назва банку задовга.",
    bankMfoTooLong: "МФО задовге.",
    bankEdrpouTooLong: "ЄДРПОУ банку задовге.",
    phoneTooLong: "Телефон задовгий.",
    emailTooLong: "Email задовгий.",
    validation: "Перевірте виділені поля.",
    conflict: "Не вдалося зберегти. Спробуйте ще раз.",
    network: "Не вдалося зберегти. Спробуйте ще раз.",
    offline: "Немає зʼєднання. Підключіться і спробуйте ще раз.",
    unavailable: "Не вдалося зберегти. Спробуйте ще раз.",
    permission: "Немає права змінювати цей запис.",
  },
};

const en: CompaniesCopy = {
  title: "Company",
  backLabel: "Back",
  loadingLabel: "Loading company",
  offlineTitle: "No connection",
  offlineDescription:
    "Company settings are unavailable offline. Connect and try again.",
  errorTitle: "Could not load the company",
  errorDescription: "Check your connection and try again.",
  retry: "Retry",
  permissionTitle: "No permission",
  permissionDescription:
    "Company settings are available to the owner and admin.",
  slugDisplay: "shozee.com.ua/{{slug}}",
  prefixTitle: "Number prefix",
  prefixExplanation:
    "Orders and invoices are numbered {{prefix}}-1048. The code does not change.",
  documentsSection: "Documents",
  legalLabel: "Legal requisites",
  legalMissing: "Not added yet — required for invoices",
  legalForm: enLegalForm,
};

const uk: CompaniesCopy = {
  title: "Компанія",
  backLabel: "Назад",
  loadingLabel: "Завантаження компанії",
  offlineTitle: "Немає зʼєднання",
  offlineDescription:
    "Налаштування компанії недоступні офлайн. Підключіться і спробуйте ще раз.",
  errorTitle: "Не вдалося завантажити компанію",
  errorDescription: "Перевірте з’єднання та спробуйте ще раз.",
  retry: "Повторити",
  permissionTitle: "Немає права",
  permissionDescription:
    "Налаштування компанії доступні власнику та адміністратору.",
  slugDisplay: "shozee.com.ua/{{slug}}",
  prefixTitle: "Префікс номерів",
  prefixExplanation:
    "Замовлення і рахунки нумеруються як {{prefix}}-1048. Код не змінюється.",
  documentsSection: "Документи",
  legalLabel: "Юридичні реквізити",
  legalMissing: "Ще не додано — потрібні для рахунків",
  legalForm: ukLegalForm,
};

export function companiesCopy(locale: Locale): CompaniesCopy {
  return locale === "uk" ? uk : en;
}
