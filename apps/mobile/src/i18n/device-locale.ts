/**
 * Device-locale wrapper. Reads `expo-localization.getLocales()` once at
 * app start and binds the tag so production `detectLocale()` calls (no
 * argument) follow the device instead of always returning `"uk"`.
 */
import { getLocales } from "expo-localization";

import {
  bindResolvedLanguageTag,
  detectLocale,
  isLanguageTagBound,
  type Locale,
} from "./locale";

const DEFAULT_LANGUAGE_TAG = "uk";

export function readDeviceLanguageTag(): string {
  const primary = getLocales()[0];
  if (primary.languageTag.length > 0) {
    return primary.languageTag;
  }
  const code = primary.languageCode;
  if (code !== null && code.length > 0) {
    return code;
  }
  return DEFAULT_LANGUAGE_TAG;
}

export function initAppLocale(): Locale {
  if (isLanguageTagBound()) {
    return detectLocale();
  }
  const tag = readDeviceLanguageTag();
  bindResolvedLanguageTag(tag);
  return detectLocale(tag);
}
