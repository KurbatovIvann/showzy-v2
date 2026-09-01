/**
 * Ukrainian → public slug suggestion via `@showzy/validation/slug`.
 * Server `companies.create` remains the authority for uniqueness and format.
 */
import { slugifyUk } from "@showzy/validation/slug";

export const COMPANY_SLUG_MAX = 48;

export function suggestSlug(name: string): string {
  return slugifyUk(name, { max: COMPANY_SLUG_MAX });
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
