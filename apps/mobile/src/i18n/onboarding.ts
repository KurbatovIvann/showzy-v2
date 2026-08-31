/** Company onboarding copy namespace (uk/en). Locale plumbing lives in `./locale`. */
import { selectCopy } from "./copy";
import type { Locale } from "./locale";

export type OnboardingCopy = {
  readonly title: string;
  readonly subtitle: string;
  readonly nameLabel: string;
  readonly namePlaceholder: string;
  readonly slugLabel: string;
  readonly slugPlaceholder: string;
  readonly slugHint: string;
  readonly submit: string;
  readonly submitLoading: string;
  readonly errors: {
    readonly nameRequired: string;
    readonly nameTooLong: string;
    readonly slugInvalid: string;
    readonly slugOccupied: string;
    readonly validation: string;
    readonly network: string;
    readonly offline: string;
    readonly unavailable: string;
  };
};

const en: OnboardingCopy = {
  title: "About your business",
  subtitle: "Basic information to create your business profile on Shozee.",
  nameLabel: "Business name",
  namePlaceholder: "Business name",
  slugLabel: "Public address",
  slugPlaceholder: "your-business",
  slugHint: "The address of your public page on Shozee.",
  submit: "Create business profile",
  submitLoading: "Creating…",
  errors: {
    nameRequired: "Enter a business name",
    nameTooLong: "Name is too long",
    slugInvalid:
      "Latin letters, digits, and hyphen only. At least 3 characters.",
    slugOccupied: "This address is already taken. Choose another.",
    validation: "Check the name and address and try again.",
    network: "Network error. Check your connection.",
    offline: "You're offline. Check your connection and try again.",
    unavailable: "Something went wrong. Try again.",
  },
};

const uk: OnboardingCopy = {
  title: "Про ваш бізнес",
  subtitle: "Основна інформація для створення профілю бізнесу на Шозі.",
  nameLabel: "Назва бізнесу",
  namePlaceholder: "Назва бізнесу",
  slugLabel: "Публічна адреса",
  slugPlaceholder: "vash-biznes",
  slugHint: "Адреса вашої публічної сторінки на Шозі.",
  submit: "Створити профіль бізнесу",
  submitLoading: "Створюємо…",
  errors: {
    nameRequired: "Вкажіть назву бізнесу",
    nameTooLong: "Назва занадто довга",
    slugInvalid: "Тільки латиниця, цифри та дефіс. Мінімум 3 символи.",
    slugOccupied: "Ця адреса вже зайнята. Оберіть іншу.",
    validation: "Перевірте назву та адресу і спробуйте ще раз.",
    network: "Помилка мережі. Перевірте з’єднання.",
    offline: "Немає мережі. Перевірте з’єднання і спробуйте ще раз.",
    unavailable: "Щось пішло не так. Спробуйте ще раз.",
  },
};

export function onboardingCopy(locale: Locale): OnboardingCopy {
  return selectCopy(locale, { uk, en });
}
