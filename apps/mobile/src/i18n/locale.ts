/**
 * Locale detection and template interpolation shared by every copy
 * namespace. V1 shipped Ukrainian and English; V2 keeps the same pair.
 */

export type Locale = "en" | "uk";

export function detectLocale(
  locale: string = Intl.DateTimeFormat().resolvedOptions().locale,
): Locale {
  return locale.toLowerCase().startsWith("uk") ? "uk" : "en";
}

export function interpolate(
  template: string,
  vars: Readonly<Record<string, string>>,
): string {
  return template.replaceAll(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return vars[key] ?? "";
  });
}
