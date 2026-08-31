/** Auth copy namespace (uk/en). Locale plumbing lives in `./locale`. */
import type { AuthErrorKind } from "../auth/errors";
import { selectCopy } from "./copy";
import type { Locale } from "./locale";

export type AuthCopy = {
  readonly welcome: string;
  readonly welcomeMessage: string;
  readonly tagline: string;
  readonly phone: string;
  readonly email: string;
  readonly phoneLabel: string;
  readonly emailLabel: string;
  readonly phonePlaceholder: string;
  readonly emailPlaceholder: string;
  readonly continue: string;
  readonly continueLoading: string;
  readonly verifyTitle: string;
  readonly verifyPhoneMessage: string;
  readonly verifyEmailMessage: string;
  readonly verifyCode: string;
  readonly verifyLoading: string;
  readonly resendCode: string;
  readonly resendCodeIn: string;
  readonly wrongNumber: string;
  readonly wrongEmail: string;
  readonly loading: string;
  readonly retry: string;
  readonly errors: Record<AuthErrorKind, string>;
};

const en: AuthCopy = {
  welcome: "Welcome",
  welcomeMessage: "Discover amazing products and companies",
  tagline: "Manage orders easily and confidently",
  phone: "Phone",
  email: "Email",
  phoneLabel: "Phone number",
  emailLabel: "Email address",
  phonePlaceholder: "XX XXX XX XX",
  emailPlaceholder: "your@email.com",
  continue: "Continue",
  continueLoading: "Please wait…",
  verifyTitle: "Confirm sign-in",
  verifyPhoneMessage: "We've sent a 6-digit code to {{destination}}",
  verifyEmailMessage: "We've sent a 6-digit code to {{destination}}",
  verifyCode: "Verify",
  verifyLoading: "Verifying…",
  resendCode: "Resend code",
  resendCodeIn: "Resend in {{seconds}}s",
  wrongNumber: "Change number",
  wrongEmail: "Change email",
  loading: "Loading",
  retry: "Retry",
  errors: {
    invalid_identifier: "Enter a valid phone number or email.",
    invalid_otp: "Invalid code. Check the digits and try again.",
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
  tagline: "Керуйте замовленнями легко та впевнено",
  phone: "Телефон",
  email: "Email",
  phoneLabel: "Номер телефону",
  emailLabel: "Email-адреса",
  phonePlaceholder: "XX XXX XX XX",
  emailPlaceholder: "ваш@email.com",
  continue: "Продовжити",
  continueLoading: "Зачекайте…",
  verifyTitle: "Підтвердження входу",
  verifyPhoneMessage: "Ми надіслали 6-значний код на {{destination}}",
  verifyEmailMessage: "Ми надіслали 6-значний код на {{destination}}",
  verifyCode: "Підтвердити",
  verifyLoading: "Перевіряємо…",
  resendCode: "Надіслати код повторно",
  resendCodeIn: "Надіслати повторно через {{seconds}} с",
  wrongNumber: "Змінити номер",
  wrongEmail: "Змінити email",
  loading: "Завантаження",
  retry: "Повторити",
  errors: {
    invalid_identifier: "Введіть коректний номер телефону або email.",
    invalid_otp: "Невірний код. Перевірте цифри та спробуйте ще раз.",
    resend_limited: "Забагато запитів коду. Спробуйте пізніше.",
    verify_locked: "Забагато спроб. Запросіть новий код.",
    unauthenticated: "Увійдіть, щоб продовжити",
    unavailable: "Щось пішло не так",
    network: "Помилка мережі. Перевірте з’єднання.",
  },
};

export function authCopy(locale: Locale): AuthCopy {
  return selectCopy(locale, { uk, en });
}

export type VerifyMessageParts = {
  readonly before: string;
  readonly after: string;
};

const DESTINATION_PLACEHOLDER = "{{destination}}";

/**
 * Split a verify template around the first `{{destination}}` so the screen
 * can render the destination as a nested selectable `Text`. Extra
 * occurrences stay in `after` (`.split` would drop the tail).
 */
export function verifyMessageParts(template: string): VerifyMessageParts {
  const index = template.indexOf(DESTINATION_PLACEHOLDER);
  if (index === -1) {
    return { before: template, after: "" };
  }
  return {
    before: template.slice(0, index),
    after: template.slice(index + DESTINATION_PLACEHOLDER.length),
  };
}

export function errorCopy(copy: AuthCopy, kind: AuthErrorKind): string {
  return copy.errors[kind];
}
