import {
  companyScopeCopy,
  type CompanyScopeCopy,
} from "../../../i18n/companies/company-scope";
import { detectLocale } from "../../../i18n/locale";

export function useCompanyScopeCopy(): CompanyScopeCopy {
  const locale = typeof navigator === "undefined" ? "uk" : navigator.language;
  return companyScopeCopy(detectLocale(locale));
}
