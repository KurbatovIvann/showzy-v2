/**
 * Official Ukrainian → Latin slug (Cabinet of Ministers map).
 * Shared by company onboarding suggestions and server-generated group
 * slugs so the alphabet cannot drift. Domain policy (max length, empty
 * fallback, uniqueness) stays at the call site.
 */

const UK_MAP: Readonly<Record<string, string>> = {
  а: "a",
  б: "b",
  в: "v",
  г: "h",
  ґ: "g",
  д: "d",
  е: "e",
  є: "ie",
  ж: "zh",
  з: "z",
  и: "y",
  і: "i",
  ї: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ь: "",
  ю: "iu",
  я: "ia",
};

export type SlugifyUkOptions = {
  readonly max?: number;
};

/**
 * Lowercase Latin slug from a display name. Punctuation-only input
 * returns `""` — callers decide whether that is empty UI or a fallback
 * id. When `max` is set, the result is sliced and a trailing hyphen from
 * the cut is stripped.
 */
export function slugifyUk(
  name: string,
  options: SlugifyUkOptions = {},
): string {
  const transliterated = name
    .toLowerCase()
    .split("")
    .map((char) => UK_MAP[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (options.max === undefined) {
    return transliterated;
  }
  return transliterated.slice(0, options.max).replace(/-+$/g, "");
}
