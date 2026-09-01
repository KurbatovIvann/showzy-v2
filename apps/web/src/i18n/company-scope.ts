/** Company-scope copy namespace (uk/en). Locale plumbing lives in `./locale`. */
import type { Locale } from "./locale";

export type CompanyScopeCopy = {
  readonly loading: string;
  readonly pickerTitle: string;
  readonly pickerHint: string;
  readonly emptyTitle: string;
  readonly emptyDescription: string;
  readonly unknownTitle: string;
  readonly unknownDescription: string;
  readonly backToPicker: string;
  readonly switcher: string;
  readonly errorTitle: string;
  readonly errorDescription: string;
  readonly retry: string;
};

const en: CompanyScopeCopy = {
  loading: "Loading your company",
  pickerTitle: "Choose a company",
  pickerHint: "Pick the company you want to work in.",
  emptyTitle: "No companies",
  emptyDescription: "This account does not belong to any company yet.",
  unknownTitle: "Company not found",
  unknownDescription: "This address does not match any company you belong to.",
  backToPicker: "Back to companies",
  switcher: "Company",
  errorTitle: "Couldn’t load your companies",
  errorDescription: "Check your connection and try again.",
  retry: "Try again",
};

const uk: CompanyScopeCopy = {
  loading: "Завантаження вашої компанії",
  pickerTitle: "Оберіть компанію",
  pickerHint: "Оберіть компанію, з якою хочете працювати.",
  emptyTitle: "Немає компаній",
  emptyDescription: "Цей акаунт ще не належить до жодної компанії.",
  unknownTitle: "Компанію не знайдено",
  unknownDescription: "Ця адреса не збігається з вашими компаніями.",
  backToPicker: "До списку компаній",
  switcher: "Компанія",
  errorTitle: "Не вдалося завантажити компанії",
  errorDescription: "Перевірте з’єднання та спробуйте ще раз.",
  retry: "Спробувати ще раз",
};

export function companyScopeCopy(locale: Locale): CompanyScopeCopy {
  return locale === "uk" ? uk : en;
}
