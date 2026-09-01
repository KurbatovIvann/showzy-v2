/** Company onboarding copy namespace (uk/en). Locale plumbing lives in `../locale`. */
import { interpolate, type Locale } from "../locale";

export type OnboardingCopy = {
  readonly companyTitle: string;
  readonly companySubtitle: string;
  readonly nameLabel: string;
  readonly namePlaceholder: string;
  readonly slugLabel: string;
  readonly slugPlaceholder: string;
  readonly slugPreview: string;
  readonly createSubmit: string;
  readonly createSubmitLoading: string;
  readonly legalTitle: string;
  readonly legalSubtitle: string;
  readonly legalSkip: string;
  readonly typeLabel: string;
  readonly typeFop: string;
  readonly typeTov: string;
  readonly companySection: string;
  readonly legalNameLabel: string;
  readonly legalNamePlaceholder: string;
  readonly edrpouLabel: string;
  readonly edrpouPlaceholder: string;
  readonly legalAddressLabel: string;
  readonly legalAddressPlaceholder: string;
  readonly bankSection: string;
  readonly ibanLabel: string;
  readonly ibanPlaceholder: string;
  readonly bankNameLabel: string;
  readonly bankNamePlaceholder: string;
  readonly bankMfoLabel: string;
  readonly bankMfoPlaceholder: string;
  readonly legalSubmit: string;
  readonly legalSubmitLoading: string;
  readonly stepLabel: string;
  readonly errors: {
    readonly nameRequired: string;
    readonly nameTooLong: string;
    readonly slugInvalid: string;
    readonly slugOccupied: string;
    readonly legalNameRequired: string;
    readonly legalNameTooLong: string;
    readonly tooLong: string;
    readonly validation: string;
    readonly network: string;
    readonly unavailable: string;
  };
};

const en: OnboardingCopy = {
  companyTitle: "About your business",
  companySubtitle:
    "Basic information to create your business profile on Shozee.",
  nameLabel: "Business name",
  namePlaceholder: "Business name",
  slugLabel: "Public address",
  slugPlaceholder: "your-business",
  slugPreview: "shozee.com.ua/{{slug}}",
  createSubmit: "Create business profile",
  createSubmitLoading: "Creating…",
  legalTitle: "Legal details",
  legalSubtitle:
    "Requisites for invoices and documents. You can fill them in later.",
  legalSkip: "Fill in later in settings",
  typeLabel: "Entity type",
  typeFop: "FOP",
  typeTov: "LLC",
  companySection: "Company information",
  legalNameLabel: "Legal name",
  legalNamePlaceholder: "FOP Last First Patronymic",
  edrpouLabel: "EDRPOU / TIN",
  edrpouPlaceholder: "12345678",
  legalAddressLabel: "Legal address",
  legalAddressPlaceholder: "Kyiv, Khreshchatyk St, 1",
  bankSection: "Bank details",
  ibanLabel: "IBAN",
  ibanPlaceholder: "UA00 0000 0000 0000 0000 0000 000",
  bankNameLabel: "Bank",
  bankNamePlaceholder: "Monobank",
  bankMfoLabel: "MFO",
  bankMfoPlaceholder: "322001",
  legalSubmit: "Save and continue",
  legalSubmitLoading: "Saving…",
  stepLabel: "Step {{step}} of {{total}}",
  errors: {
    nameRequired: "Enter a business name",
    nameTooLong: "Name is too long",
    slugInvalid:
      "Latin letters, digits, and hyphen only. At least 3 characters.",
    slugOccupied: "This address is already taken. Choose another.",
    legalNameRequired: "Enter the legal name",
    legalNameTooLong: "Legal name is too long",
    tooLong: "This value is too long",
    validation: "Check the fields and try again.",
    network: "Network error. Check your connection.",
    unavailable: "Something went wrong. Try again.",
  },
};

const uk: OnboardingCopy = {
  companyTitle: "Про ваш бізнес",
  companySubtitle: "Основна інформація для створення профілю бізнесу на Шозі.",
  nameLabel: "Назва бізнесу",
  namePlaceholder: "Назва бізнесу",
  slugLabel: "Публічна адреса",
  slugPlaceholder: "vash-biznes",
  slugPreview: "shozee.com.ua/{{slug}}",
  createSubmit: "Створити профіль бізнесу",
  createSubmitLoading: "Створюємо…",
  legalTitle: "Юридичні дані",
  legalSubtitle:
    "Реквізити для рахунків і документів. Можна заповнити пізніше.",
  legalSkip: "Заповнити пізніше в налаштуваннях",
  typeLabel: "Тип суб’єкта",
  typeFop: "ФОП",
  typeTov: "ТОВ",
  companySection: "Інформація про компанію",
  legalNameLabel: "Юридична назва",
  legalNamePlaceholder: "ФОП Прізвище Ім’я По батькові",
  edrpouLabel: "ЄДРПОУ / ІПН",
  edrpouPlaceholder: "12345678",
  legalAddressLabel: "Юридична адреса",
  legalAddressPlaceholder: "м. Київ, вул. Хрещатик, 1",
  bankSection: "Банківські реквізити",
  ibanLabel: "IBAN",
  ibanPlaceholder: "UA00 0000 0000 0000 0000 0000 000",
  bankNameLabel: "Банк",
  bankNamePlaceholder: "Монобанк",
  bankMfoLabel: "МФО",
  bankMfoPlaceholder: "322001",
  legalSubmit: "Зберегти та продовжити",
  legalSubmitLoading: "Зберігаємо…",
  stepLabel: "Крок {{step}} з {{total}}",
  errors: {
    nameRequired: "Вкажіть назву бізнесу",
    nameTooLong: "Назва занадто довга",
    slugInvalid: "Тільки латиниця, цифри та дефіс. Мінімум 3 символи.",
    slugOccupied: "Ця адреса вже зайнята. Оберіть іншу.",
    legalNameRequired: "Вкажіть юридичну назву",
    legalNameTooLong: "Юридична назва занадто довга",
    tooLong: "Значення занадто довге",
    validation: "Перевірте поля і спробуйте ще раз.",
    network: "Помилка мережі. Перевірте з’єднання.",
    unavailable: "Щось пішло не так. Спробуйте ще раз.",
  },
};

export function onboardingCopy(locale: Locale): OnboardingCopy {
  return locale === "uk" ? uk : en;
}

export function slugPreviewCopy(copy: OnboardingCopy, slug: string): string {
  return interpolate(copy.slugPreview, {
    slug: slug.length === 0 ? "…" : slug,
  });
}

export function stepLabelCopy(
  copy: OnboardingCopy,
  step: number,
  total: number,
): string {
  return interpolate(copy.stepLabel, {
    step: String(step),
    total: String(total),
  });
}
