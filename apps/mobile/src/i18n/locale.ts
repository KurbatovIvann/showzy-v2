/**
 * Locale detection and template interpolation shared by every copy
 * namespace. V1 shipped Ukrainian and English; V2 keeps the same pair.
 * Ukrainian is the product default (UA-first). English only when the
 * locale is explicitly `en*`.
 *
 * `detectLocale(tag)` is pure. Production `detectLocale()` with no
 * argument reads the language tag captured once at app start by
 * `initAppLocale()` (wrapper over `expo-localization.getLocales()`).
 * Before that init — including in tests — the no-argument default is
 * `"uk"`.
 */

export type Locale = "en" | "uk";

const DEFAULT_LANGUAGE_TAG = "uk";

let resolvedLanguageTag: string | undefined;

/**
 * Bind the device language tag resolved at app start. Later no-argument
 * `detectLocale()` calls use this tag instead of the Ukrainian default.
 */
export function bindResolvedLanguageTag(tag: string): void {
  resolvedLanguageTag = tag;
}

/** Restore the pre-init Ukrainian default. Tests only. */
export function resetResolvedLanguageTagForTests(): void {
  resolvedLanguageTag = undefined;
}

export function detectLocale(
  locale: string = resolvedLanguageTag ?? DEFAULT_LANGUAGE_TAG,
): Locale {
  return locale.toLowerCase().startsWith("en") ? "en" : "uk";
}

export function interpolate(
  template: string,
  vars: Readonly<Record<string, string>>,
): string {
  return template.replaceAll(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (!Object.hasOwn(vars, key)) {
      return "";
    }
    return vars[key] ?? "";
  });
}
