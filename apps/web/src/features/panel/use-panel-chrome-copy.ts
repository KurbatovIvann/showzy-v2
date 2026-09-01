import { panelChromeCopy, type PanelChromeCopy } from "../../i18n/panel/chrome";
import { detectLocale } from "../../i18n/locale";

export function usePanelChromeCopy(): PanelChromeCopy {
  const locale = typeof navigator === "undefined" ? "uk" : navigator.language;
  return panelChromeCopy(detectLocale(locale));
}
