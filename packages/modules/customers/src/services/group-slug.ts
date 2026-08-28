import { randomUUID } from "node:crypto";

import { GROUP_SLUG_MAX } from "../actions/group-view.contract.js";

export const GROUP_SLUG_SHORT_ID_LENGTH = 8;
export const GROUP_SLUG_FALLBACK_PREFIX = "group-";
export const CUSTOMER_GROUPS_COMPANY_SLUG_UQ =
  "customer_groups_company_slug_uq";

/**
 * Official Ukrainian transliteration used by the onboarding slug
 * suggestion. Copied here so group slugs do not depend on the mobile app.
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

/**
 * Latin slug from a trimmed group name, or `undefined` when nothing
 * usable remains (punctuation-only / combining-mark-only names). The
 * caller then stores `group-{shortid}`.
 */
export function slugFromName(name: string): string | undefined {
  const transliterated = name
    .toLowerCase()
    .split("")
    .map((char) => UK_MAP[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (transliterated.length === 0) {
    return undefined;
  }
  return (
    transliterated.slice(0, GROUP_SLUG_MAX).replace(/-+$/g, "") || undefined
  );
}

/** `group-` plus 8 hex chars from a v4 UUID. Unique enough to retry on 23505. */
export function groupFallbackSlug(): string {
  return `${GROUP_SLUG_FALLBACK_PREFIX}${randomUUID()
    .replaceAll("-", "")
    .slice(0, GROUP_SLUG_SHORT_ID_LENGTH)}`;
}

export function isGroupFallbackSlug(slug: string): boolean {
  return new RegExp(
    `^${GROUP_SLUG_FALLBACK_PREFIX}[0-9a-f]{${String(GROUP_SLUG_SHORT_ID_LENGTH)}}$`,
  ).test(slug);
}
