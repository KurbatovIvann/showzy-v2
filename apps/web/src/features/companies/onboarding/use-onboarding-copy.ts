import {
  onboardingCopy,
  type OnboardingCopy,
} from "../../../i18n/companies/onboarding";
import { detectLocale } from "../../../i18n/locale";

export function useOnboardingCopy(): OnboardingCopy {
  const locale = typeof navigator === "undefined" ? "uk" : navigator.language;
  return onboardingCopy(detectLocale(locale));
}
