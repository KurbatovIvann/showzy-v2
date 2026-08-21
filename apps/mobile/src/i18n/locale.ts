/**
 * Locale detection and template interpolation shared by every copy
 * namespace. V1 shipped Ukrainian and English; V2 keeps the same pair.
 * Ukrainian is the product default (UA-first). English only when the
 * locale is explicitly `en*`.
 */

export type Locale = "en" | "uk";

export function detectLocale(locale: string = "uk"): Locale {
  return locale.toLowerCase().startsWith("en") ? "en" : "uk";
}

export function interpolate(
  template: string,
  vars: Readonly<Record<string, string>>,
): string {
  return template.replaceAll(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return vars[key] ?? "";
  });
}
