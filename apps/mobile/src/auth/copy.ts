import type { AuthErrorKind } from "./errors";
import type { AuthChannel } from "./identifiers";

export type AuthLocale = "en" | "uk";

export type AuthCopy = {
  readonly welcome: string;
  readonly welcomeMessage: string;
  readonly phone: string;
  readonly email: string;
  readonly phonePlaceholder: string;
  readonly emailPlaceholder: string;
  readonly continue: string;
  readonly verifyTitle: string;
  readonly verifyPhoneMessage: string;
  readonly verifyEmailMessage: string;
  readonly verifyCode: string;
  readonly resendCode: string;
  readonly resendCodeIn: string;
  readonly wrongNumber: string;
  readonly wrongEmail: string;
  readonly signOut: string;
  readonly sessionTitle: string;
  readonly signedInAs: string;
  readonly userId: string;
  readonly companySelector: string;
  readonly companySelectorStub: string;
  readonly loading: string;
  readonly retry: string;
  readonly errors: Record<AuthErrorKind, string>;
};

const en: AuthCopy = {
  welcome: "Welcome",
  welcomeMessage: "Discover amazing products and companies",
  phone: "Phone",
  email: "Email",
  phonePlaceholder: "XX XXX XX XX",
  emailPlaceholder: "your@email.com",
  continue: "Continue",
  verifyTitle: "Confirm sign-in",
  verifyPhoneMessage: "We've sent a 6-digit code to {{destination}}",
  verifyEmailMessage: "We've sent a 6-digit code to {{destination}}",
  verifyCode: "Verify",
  resendCode: "Resend code",
  resendCodeIn: "Resend code in {{seconds}}s",
  wrongNumber: "← Wrong number?",
  wrongEmail: "← Wrong email?",
  signOut: "Sign Out",
  sessionTitle: "Signed in",
  signedInAs: "Session",
  userId: "User ID",
  companySelector: "Active company",
  companySelectorStub:
    "None — company list waits on companies.listMine (phase 2).",
  loading: "Loading",
  retry: "Retry",
  errors: {
    invalid_identifier: "Enter a valid phone number or email.",
    invalid_otp: "Invalid verification code",
    resend_limited: "Too many OTP requests. Try again later.",
    verify_locked: "Too many attempts. Request a new code.",
    unauthenticated: "Please sign in to continue",
    unavailable: "Something went wrong",
    network: "Network error. Please check your connection.",
  },
};

const uk: AuthCopy = {
  welcome: "Ласкаво просимо",
  welcomeMessage: "Відкривайте чудові товари та компанії",
  phone: "Телефон",
  email: "Email",
  phonePlaceholder: "XX XXX XX XX",
  emailPlaceholder: "ваш@email.com",
  continue: "Продовжити",
  verifyTitle: "Підтвердження входу",
  verifyPhoneMessage: "Ми надіслали 6-значний код на {{destination}}",
  verifyEmailMessage: "Ми надіслали 6-значний код на {{destination}}",
  verifyCode: "Підтвердити",
  resendCode: "Надіслати код ще раз",
  resendCodeIn: "Повторне надсилання через {{seconds}} с",
  wrongNumber: "← Невірний номер?",
  wrongEmail: "← Невірний email?",
  signOut: "Вийти",
  sessionTitle: "Вхід виконано",
  signedInAs: "Сесія",
  userId: "ID користувача",
  companySelector: "Активна компанія",
  companySelectorStub:
    "Немає — список компаній чекає на companies.listMine (фаза 2).",
  loading: "Завантаження",
  retry: "Повторити",
  errors: {
    invalid_identifier: "Введіть коректний номер телефону або email.",
    invalid_otp: "Невірний код підтвердження",
    resend_limited: "Забагато запитів коду. Спробуйте пізніше.",
    verify_locked: "Забагато спроб. Запросіть новий код.",
    unauthenticated: "Увійдіть, щоб продовжити",
    unavailable: "Щось пішло не так",
    network: "Помилка мережі. Перевірте з’єднання.",
  },
};

export function detectAuthLocale(
  locale: string = Intl.DateTimeFormat().resolvedOptions().locale,
): AuthLocale {
  return locale.toLowerCase().startsWith("uk") ? "uk" : "en";
}

export function authCopy(locale: AuthLocale): AuthCopy {
  return locale === "uk" ? uk : en;
}

export function interpolate(
  template: string,
  vars: Readonly<Record<string, string>>,
): string {
  return template.replaceAll(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return vars[key] ?? "";
  });
}

export function verifyMessage(
  copy: AuthCopy,
  channel: AuthChannel,
  destination: string,
): string {
  const template =
    channel === "phone" ? copy.verifyPhoneMessage : copy.verifyEmailMessage;
  return interpolate(template, { destination });
}

export function errorCopy(copy: AuthCopy, kind: AuthErrorKind): string {
  return copy.errors[kind];
}
