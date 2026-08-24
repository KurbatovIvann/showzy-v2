/**
 * Ukrainian → public slug suggestion (Magic Patterns `slugifyUk`).
 * Server `companies.create` remains the authority for uniqueness and format.
 */
export const COMPANY_SLUG_MAX = 48;

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

export function suggestSlug(name: string): string {
  const transliterated = name
    .toLowerCase()
    .split("")
    .map((char) => UK_MAP[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return transliterated.slice(0, COMPANY_SLUG_MAX).replace(/-+$/g, "");
}

export function sanitizeSlugInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, COMPANY_SLUG_MAX);
}

export function nextSlugAfterNameChange(args: {
  readonly name: string;
  readonly slugTouched: boolean;
  readonly currentSlug: string;
}): string {
  return args.slugTouched ? args.currentSlug : suggestSlug(args.name);
}
