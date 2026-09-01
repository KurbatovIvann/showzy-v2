/** Staff assistant (Shozik) copy namespace (uk/en). */
import { selectCopy, writeErrorsEn, writeErrorsUk } from "./copy";
import type { Locale } from "./locale";

export type AssistantCopy = {
  readonly sheetTitle: string;
  readonly emptyTitle: string;
  readonly emptyDescription: string;
  readonly inputPlaceholder: string;
  readonly inputLabel: string;
  readonly sendLabel: string;
  readonly confirmLabel: string;
  readonly dismissLabel: string;
  readonly confirmingLabel: string;
  readonly confirmationTitle: string;
  readonly thinkingLabel: string;
  readonly errors: {
    readonly validation: string;
    readonly network: string;
    readonly offline: string;
    readonly unavailable: string;
    readonly permission: string;
    readonly unauthenticated: string;
    readonly notConfigured: string;
  };
};

const en: AssistantCopy = {
  sheetTitle: "Shozik",
  emptyTitle: "How can I help?",
  emptyDescription:
    "I can look up orders, customers, and documents. Writes run only after you confirm.",
  inputPlaceholder: "Write a request…",
  inputLabel: "Message to the assistant",
  sendLabel: "Send",
  confirmLabel: "Confirm",
  dismissLabel: "Cancel",
  confirmingLabel: "Confirming…",
  confirmationTitle: "Confirmation required",
  thinkingLabel: "Shozik is thinking",
  errors: {
    ...writeErrorsEn,
    network: "Could not reach the assistant. Try again.",
    unavailable: "The assistant is unavailable. Try again.",
    permission: "You do not have permission to use the assistant.",
    unauthenticated: "Sign in again to continue.",
    notConfigured: "The assistant is not configured.",
  },
};

const uk: AssistantCopy = {
  sheetTitle: "Шозік",
  emptyTitle: "Чим допомогти?",
  emptyDescription:
    "Знайду замовлення, клієнтів і документи. Запис у систему — лише після підтвердження.",
  inputPlaceholder: "Напишіть запит…",
  inputLabel: "Повідомлення асистенту",
  sendLabel: "Надіслати",
  confirmLabel: "Підтвердити",
  dismissLabel: "Скасувати",
  confirmingLabel: "Підтверджую…",
  confirmationTitle: "Потрібне підтвердження",
  thinkingLabel: "Шозік думає",
  errors: {
    ...writeErrorsUk,
    network: "Не вдалося звʼязатися з асистентом. Спробуйте ще раз.",
    unavailable: "Асистент недоступний. Спробуйте ще раз.",
    permission: "Немає права користуватися асистентом.",
    unauthenticated: "Увійдіть знову, щоб продовжити.",
    notConfigured: "Асистент не налаштований.",
  },
};

export function assistantCopy(locale: Locale): AssistantCopy {
  return selectCopy(locale, { uk, en });
}
