import type { Locale } from "./locale";

export type CompanyResolutionCopy = {
  readonly loading: string;
  readonly errorTitle: string;
  readonly errorDescription: string;
  readonly retry: string;
  readonly multipleTitle: string;
  readonly multipleDescription: string;
  readonly signOut: string;
};

const en: CompanyResolutionCopy = {
  loading: "Loading your company",
  errorTitle: "Couldn’t load your companies",
  errorDescription:
    "Check your connection and try again. Company onboarding has not started.",
  retry: "Try Again",
  multipleTitle: "Choose a company",
  multipleDescription:
    "This account belongs to multiple companies. Company switching is coming soon.",
  signOut: "Sign Out",
};

const uk: CompanyResolutionCopy = {
  loading: "Завантаження вашої компанії",
  errorTitle: "Не вдалося завантажити компанії",
  errorDescription:
    "Перевірте з’єднання та спробуйте ще раз. Створення компанії не розпочато.",
  retry: "Спробувати ще раз",
  multipleTitle: "Оберіть компанію",
  multipleDescription:
    "Цей акаунт належить до кількох компаній. Перемикання між компаніями з’явиться незабаром.",
  signOut: "Вийти",
};

export function companyResolutionCopy(locale: Locale): CompanyResolutionCopy {
  return locale === "uk" ? uk : en;
}
